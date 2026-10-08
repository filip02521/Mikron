"use server";

// Autoryzacja: podgląd i zaznaczanie — requireOperations(); zapis do Subiekta — tylko admin
// (requireAdminForMutation). Zapis cen na hoście SUBIEKT_API_BASE_URL
// albo na porcie wybranym przez admina (actionSetPricesHost).

import { revalidatePath } from "next/cache";
import { requireAdminForMutation, requireOperations } from "@/lib/auth";
import { readSpreadsheetSheets, isSpreadsheetFile } from "@/lib/customs/customs-spreadsheet";
import {
  baseSymbol,
  comparePrices,
  foreignCurrency,
  normalizeSymbol,
  parsePriceListRows,
  pieceFactor,
  priceHardBlock,
  priceListProfile,
  profileColumns,
  SAME,
  stillAsPreviewed,
  type PriceListRow,
} from "@/lib/price-lists/price-list";
import {
  fetchCechaProducts,
  fetchCechaVat,
  getPricesHost,
  hasExactPricesEndpoint,
  PRICES_HOST_SETTING_KEY,
  readPrices,
  readPricesMany,
  searchPriceCechy,
  writePrices,
} from "@/lib/price-lists/subiekt-prices";
import {
  finishPriceItem,
  finishRestoreItem,
  getPriceItems,
  findSamePriceListImport,
  getPriceListImport,
  insertPriceListImport,
  markPriceItemsOverride,
  newerPriceListImport,
  nextRestorable,
  nextSelectedPending,
  retryFailedPriceItems,
  setPriceItemsSelected,
  updatePriceListImport,
  type NewPriceListItem,
} from "@/lib/price-lists/data";
import { tryAcquireLock, releaseLock } from "@/lib/services/locks";
import { query } from "@/lib/db/pool";

const CENNIKI_PATH = "/zakupy/cenniki";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_THRESHOLD_PCT = 5;
/** Zapis SQL ~10 ms + 2 odczyty na pozycję; bez nowego endpointu Sfera ~1,5 s — 50 mieści się w limicie żądania. */
const APPLY_CHUNK = 50;

const zl = (v: number | null) => (v == null ? "brak" : v.toFixed(2).replace(".", ","));

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function errorText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

/**
 * Wgrany cennik → porównanie z cenami towarów cechy dostawcy → zapis podglądu w bazie.
 * Nic nie zmienia w Subiekcie.
 */
export async function actionPreparePriceList(formData: FormData): Promise<Result<{ id: string; updated: boolean }>> {
  const user = await requireOperations("mutate");
  const host = await getPricesHost();
  if (!host.ok) return { ok: false, error: host.error };
  const cfg = host.host.config;

  const file = formData.get("file");
  // Rodzaj cennika wybiera się z listy profili: stała cecha i stały układ kolumn danego dostawcy.
  const profile = priceListProfile(String(formData.get("profile") ?? ""));
  if (!profile) return { ok: false, error: "Wybierz rodzaj cennika." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Wybierz plik cennika." };
  if (file.size > MAX_FILE_SIZE) return { ok: false, error: "Plik jest większy niż 10 MB." };
  if (!isSpreadsheetFile(file.name, file.type)) return { ok: false, error: "Cennik musi być plikiem Excel lub CSV." };
  // Cecha z Subiekta po nazwie z profilu — do historii trafia to, co naprawdę porównano.
  let cechaId: number;
  let cechaName: string;
  try {
    const want = profile.cechaName.trim().toLowerCase();
    const found = (await searchPriceCechy(cfg, profile.cechaName)).filter(
      (c) => String(c.ctw_Nazwa ?? "").trim().toLowerCase() === want
    );
    if (found.length !== 1) {
      return {
        ok: false,
        error: found.length
          ? `W Subiekcie jest ${found.length} cech o nazwie „${profile.cechaName}” — nie wiem, której użyć. Zostaw jedną.`
          : `W Subiekcie nie ma cechy „${profile.cechaName}”.`,
      };
    }
    cechaId = found[0]!.ctw_Id;
    cechaName = String(found[0]!.ctw_Nazwa);
  } catch (e) {
    return { ok: false, error: errorText(e, "Nie udało się sprawdzić cechy w Subiekcie.") };
  }

  let parsed: { rows: PriceListRow[]; validFrom: string | null };
  let columns;
  try {
    const sheets = await readSpreadsheetSheets(Buffer.from(await file.arrayBuffer()), file.name);
    const results = sheets.map((sh) => ({ sh, res: profileColumns(sh, profile) }));
    const hit = results.find((r) => r.res.ok);
    if (!hit || !hit.res.ok) {
      const missing = results
        .map((r) => (r.res.ok ? [] : r.res.missing))
        .reduce((a, b) => (b.length < a.length ? b : a), Object.values(profile.headers));
      return {
        ok: false,
        error: `To nie jest cennik ${profile.label} w znanym układzie — brakuje kolumn: ${missing.join(", ")}. Wgraj oryginalny plik od dostawcy; inne cenniki dodamy jako osobne rodzaje.`,
      };
    }
    const sheet = hit.sh;
    columns = hit.res.columns;
    const currency = foreignCurrency(sheet, columns);
    if (currency) {
      return { ok: false, error: `Cennik jest w walucie ${currency}, a ceny w Subiekcie są w PLN. Wgraj cennik w złotówkach.` };
    }
    parsed = parsePriceListRows(sheet, columns);
  } catch (e) {
    return { ok: false, error: errorText(e, "Nie udało się odczytać pliku.") };
  }
  if (parsed.rows.length === 0) return { ok: false, error: "W cenniku nie ma pozycji z numerem i ceną." };

  const bySymbol = new Map<string, PriceListRow[]>();
  for (const r of parsed.rows) bySymbol.set(r.symbol, [...(bySymbol.get(r.symbol) ?? []), r]);

  try {
    const [products, vat] = await Promise.all([
      fetchCechaProducts(cfg, cechaId),
      fetchCechaVat(cfg, cechaId),
    ]);
    if (products.length === 0) return { ok: false, error: `Cecha „${cechaName}” nie ma towarów w Subiekcie.` };

    const symbolCount = new Map<string, number>();
    for (const p of products) {
      const s = normalizeSymbol(p.tw_Symbol);
      symbolCount.set(s, (symbolCount.get(s) ?? 0) + 1);
    }
    // Dokładny symbol; inaczej karta sztuki („761302 1SZT.”) obok karty opakowania „761302” z cennika.
    const byProductSymbol = new Map(products.map((p) => [normalizeSymbol(p.tw_Symbol), p]));
    const matchFor = (p: (typeof products)[number]): { rows: PriceListRow[]; pieceFactor?: number } | null => {
      const symbol = normalizeSymbol(p.tw_Symbol);
      const exact = bySymbol.get(symbol);
      if (exact) return { rows: exact };
      const base = baseSymbol(symbol);
      const pkg = base ? byProductSymbol.get(base) : undefined;
      const rows = base ? bySymbol.get(base) : undefined;
      if (!pkg || !rows) return null;
      const factor = pieceFactor(String(pkg.tw_Nazwa ?? ""), String(p.tw_Nazwa ?? ""));
      return factor ? { rows, pieceFactor: factor } : null;
    };
    const matches = new Map(products.map((p) => [p.tw_Id, matchFor(p)]));
    const matched = products.filter((p) => matches.get(p.tw_Id));
    const { prices, errors } = await readPricesMany(cfg, matched.map((p) => p.tw_Id));
    const fatal = [...errors.values()].find((m) => m.startsWith("Poziom ceny"));
    if (fatal || (matched.length > 0 && errors.size === matched.length)) {
      return { ok: false, error: fatal ?? `Nie udało się odczytać cen z Subiekta: ${errors.values().next().value}` };
    }

    const items: NewPriceListItem[] = products.map((p) => {
      const symbol = normalizeSymbol(p.tw_Symbol);
      const name = String(p.tw_Nazwa ?? "").trim();
      const match = matches.get(p.tw_Id);
      const listRows = match?.rows;
      const base = {
        twId: p.tw_Id,
        symbol,
        name,
        vatSubiekt: vat.get(p.tw_Id) ?? null,
      };
      if (!listRows) {
        return {
          ...base,
          listName: null,
          listRow: null,
          packFactor: 1,
          vatList: null,
          listDiscount: null,
          oldPurchase: null,
          oldRetail: null,
          newPurchase: null,
          newRetail: null,
          flags: [],
          selected: false,
          status: "not_in_list" as const,
        };
      }
      const list = listRows[0]!;
      const old = prices.get(p.tw_Id);
      const cmp = comparePrices({
        list,
        subiekt: {
          name,
          purchase: old?.purchase ?? null,
          retail: old?.retail ?? null,
          vat: base.vatSubiekt,
          blocked: Number(p.tw_Zablokowany) === 1,
        },
        thresholdPct: DEFAULT_THRESHOLD_PCT,
        duplicate: listRows.length > 1 || (symbolCount.get(symbol) ?? 0) > 1,
        pieceFactor: match?.pieceFactor,
      });
      // Bez odczytu nie wiemy, co nadpisujemy — pozycja zostaje odznaczona i zablokowana (priceHardBlock).
      if (!old) {
        cmp.flags = [...cmp.flags.filter((f) => f !== "unchanged" && f !== "old_zero" && f !== "suspicious"), "read_error"];
        cmp.selected = false;
      }
      return {
        ...base,
        listName: list.name || null,
        listRow: list.row,
        packFactor: cmp.packFactor,
        vatList: list.vat,
        listDiscount: list.discount,
        oldPurchase: old?.purchase ?? null,
        oldRetail: old?.retail ?? null,
        newPurchase: cmp.newPurchase,
        newRetail: cmp.newRetail,
        flags: cmp.flags,
        selected: cmp.selected,
        status: "pending" as const,
      };
    });

    const matchedSymbols = new Set(matched.map((p) => matches.get(p.tw_Id)!.rows[0]!.symbol));
    const input = {
      createdBy: user.id,
      fileName: file.name,
      cechaId,
      cechaName,
      hostKind: host.host.hostKind,
      validFrom: parsed.validFrom,
      thresholdPct: DEFAULT_THRESHOLD_PCT,
      columns,
      pricelistRows: parsed.rows.length,
      pricelistUnmatched: [...bySymbol.keys()].filter((s) => !matchedSymbols.has(s)).length,
      items,
    };
    // Ten sam cennik wgrany ponownie → aktualizacja wpisu (bez dublowania historii); zapis w toku blokuje.
    const existing = await findSamePriceListImport(input);
    if (existing) {
      const lockKey = `price_list_apply_${existing}`;
      if (!(await tryAcquireLock(lockKey, 180, user.id))) {
        return { ok: false, error: "Trwa zapis tego cennika do Subiekta — wgraj go ponownie po zakończeniu." };
      }
      try {
        await updatePriceListImport(existing, input);
      } finally {
        await releaseLock(lockKey);
      }
      revalidatePath(CENNIKI_PATH);
      revalidatePath(`${CENNIKI_PATH}/${existing}`);
      return { ok: true, id: existing, updated: true };
    }
    const id = await insertPriceListImport(input);
    revalidatePath(CENNIKI_PATH);
    return { ok: true, id, updated: false };
  } catch (e) {
    return { ok: false, error: errorText(e, "Nie udało się porównać cennika z Subiektem.") };
  }
}

/**
 * `override` (tylko administrator): pozycje zablokowane skalą zmiany zostają zaznaczone świadomie —
 * np. stara cena w Subiekcie była błędna. Cena ≤ 0 i błąd odczytu dalej blokują.
 */
export async function actionSetPriceItemsSelected(
  importId: string,
  ids: number[],
  selected: boolean,
  override = false
): Promise<Result<{ skipped: { id: number; symbol: string; reason: string }[] }>> {
  if (override) await requireAdminForMutation();
  else await requireOperations("mutate");
  try {
    let valid = Array.isArray(ids) ? ids.filter(Number.isInteger) : [];
    const skipped: { id: number; symbol: string; reason: string }[] = [];
    if (selected && override && valid.length) await markPriceItemsOverride(importId, valid);
    if (selected) {
      const blocked = new Set<number>();
      for (const item of await getPriceItems(importId, valid)) {
        const reason = priceHardBlock(item);
        if (reason) {
          blocked.add(item.id);
          skipped.push({ id: item.id, symbol: item.symbol, reason });
        }
      }
      valid = valid.filter((id) => !blocked.has(id));
    }
    if (valid.length) await setPriceItemsSelected(importId, valid, selected);
    return { ok: true, skipped };
  } catch (e) {
    return { ok: false, error: errorText(e, "Nie udało się zmienić zaznaczenia.") };
  }
}

export async function actionRetryFailedPriceItems(importId: string): Promise<Result<{ count: number }>> {
  await requireOperations("mutate");
  try {
    const count = await retryFailedPriceItems(importId);
    revalidatePath(`${CENNIKI_PATH}/${importId}`);
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: errorText(e, "Nie udało się przywrócić pozycji.") };
  }
}

export type ApplyChunkResult = Result<{ processed: number; remaining: number; exact: boolean }>;

/**
 * Zapisuje kolejną partię zaznaczonych pozycji. Dla każdej: odczyt (czy nikt nie zmienił ceny po podglądzie)
 * → zapis → odczyt kontrolny i porównanie z cennikiem. Klient woła do skutku (`remaining` = 0).
 */
export async function actionApplyPriceListChunk(importId: string): Promise<ApplyChunkResult> {
  // Masowy zapis do ERP — tylko administrator (podgląd i zaznaczanie zostają dla zakupów).
  const user = await requireAdminForMutation();
  const host = await getPricesHost();
  if (!host.ok) return { ok: false, error: host.error };
  const imp = await getPriceListImport(importId);
  if (!imp) return { ok: false, error: "Nie ma takiego cennika." };
  if (imp.hostKind !== host.host.hostKind) {
    return {
      ok: false,
      error: `Cennik przygotowano na innym Subiekcie (${imp.hostKind === "live" ? "LIVE" : "test"}), a OnTime wskazuje teraz ${host.host.label}. Wgraj cennik ponownie.`,
    };
  }

  // Starszy podgląd tej samej cechy nie może nadpisać tego, co pokazał nowszy.
  const newer = await newerPriceListImport(imp);
  if (newer) {
    return { ok: false, error: "Jest nowszy cennik tej cechy — zapisuj z niego. Ten podgląd jest nieaktualny." };
  }

  const lockKey = `price_list_apply_${importId}`;
  if (!(await tryAcquireLock(lockKey, 180, user.id))) {
    return { ok: false, error: "Zapis tego cennika już trwa (inna karta lub osoba)." };
  }
  const cfg = host.host.config;
  try {
    const exact = await hasExactPricesEndpoint(cfg);
    const items = await nextSelectedPending(importId, APPLY_CHUNK);
    for (const item of items) {
      const target = { purchase: item.newPurchase, retail: item.newRetail };
      const expected = { purchase: item.oldPurchase, retail: item.oldRetail };
      const block = priceHardBlock(item);
      if (block) {
        await finishPriceItem({
          id: item.id,
          status: "failed",
          error: block,
          afterPurchase: null,
          afterRetail: null,
          appliedBy: user.id,
        });
        continue;
      }
      try {
        const now = await readPrices(cfg, item.twId);
        const differs = (a: number | null, b: number | null) =>
          a == null || b == null ? a !== b : Math.abs(a - b) >= SAME;
        if (!stillAsPreviewed(now, expected, target)) {
          await finishPriceItem({
            id: item.id,
            status: "changed",
            error: "Cena w Subiekcie zmieniła się po podglądzie — nie nadpisano. Wgraj cennik ponownie.",
            afterPurchase: now.purchase,
            afterRetail: now.retail,
            appliedBy: user.id,
          });
          continue;
        }
        await writePrices(cfg, item.twId, target, now, exact);
        const after = await readPrices(cfg, item.twId);
        const off: string[] = [];
        if (target.purchase != null && differs(after.purchase, target.purchase)) {
          off.push(`kartotekowa ${zl(after.purchase)} zamiast ${zl(target.purchase)}`);
        }
        if (target.retail != null && differs(after.retail, target.retail)) {
          off.push(
            `detaliczna ${zl(after.retail)} zamiast ${zl(target.retail)}${exact ? "" : " (ten Subiekt nie ma jeszcze zapisu poziomu ceny — detaliczna z narzutu)"}`
          );
        }
        await finishPriceItem({
          id: item.id,
          status: off.length ? "mismatch" : "applied",
          error: off.length ? off.join("; ") : null,
          afterPurchase: after.purchase,
          afterRetail: after.retail,
          appliedBy: user.id,
        });
      } catch (e) {
        await finishPriceItem({
          id: item.id,
          status: "failed",
          error: errorText(e, "Błąd zapisu w Subiekcie."),
          afterPurchase: null,
          afterRetail: null,
          appliedBy: user.id,
        });
      }
    }
    const left = await getPriceListImport(importId);
    return { ok: true, processed: items.length, remaining: left?.counts.selectedPending ?? 0, exact };
  } catch (e) {
    return { ok: false, error: errorText(e, "Zapis przerwany.") };
  } finally {
    await releaseLock(lockKey);
    revalidatePath(`${CENNIKI_PATH}/${importId}`);
  }
}

export type RestoreResult = Result<{ processed: number; restored: number; remaining: number }>;

/**
 * Przywraca ceny z kopii sprzed cennika (backup_*) w pozycjach, które OnTime zapisał w Subiekcie.
 * Bez `ids` — kolejna partia wszystkich zapisanych (klient woła do `remaining` = 0); z `ids` — tylko te.
 * Przed zapisem: cena w Subiekcie musi być tą zapisaną przez OnTime (albo już kopią) — ręcznej zmiany
 * po zapisie nie nadpisujemy. Po zapisie odczyt kontrolny i porównanie z kopią.
 */
export async function actionRestorePriceList(importId: string, ids?: number[]): Promise<RestoreResult> {
  const user = await requireAdminForMutation();
  const host = await getPricesHost();
  if (!host.ok) return { ok: false, error: host.error };
  const imp = await getPriceListImport(importId);
  if (!imp) return { ok: false, error: "Nie ma takiego cennika." };
  if (imp.hostKind !== host.host.hostKind) {
    return { ok: false, error: `Kopia pochodzi z innego Subiekta (${imp.hostKind === "live" ? "LIVE" : "test"}) niż wskazuje teraz OnTime (${host.host.label}).` };
  }
  const cfg = host.host.config;
  if (!(await hasExactPricesEndpoint(cfg))) {
    return { ok: false, error: "Ten Subiekt nie ma zapisu poziomu ceny (PUT /price/catalog/levels) — detalicznej nie da się przywrócić dokładnie." };
  }
  const only = Array.isArray(ids) ? ids.filter(Number.isInteger).slice(0, APPLY_CHUNK) : undefined;
  if (only && only.length === 0) return { ok: false, error: "Nie wskazano pozycji." };

  const lockKey = `price_list_apply_${importId}`;
  if (!(await tryAcquireLock(lockKey, 180, user.id))) {
    return { ok: false, error: "Trwa zapis tego cennika (inna karta lub osoba)." };
  }
  let restored = 0;
  try {
    const items = await nextRestorable(importId, APPLY_CHUNK, only);
    for (const item of items) {
      const backup = { purchase: item.backupPurchase, retail: item.backupRetail };
      const written = {
        purchase: item.afterPurchase ?? item.newPurchase,
        retail: item.afterRetail ?? item.newRetail,
      };
      const fail = (error: string) =>
        finishRestoreItem({ id: item.id, status: "restore_failed", error, afterPurchase: null, afterRetail: null, restoredBy: user.id });
      try {
        const now = await readPrices(cfg, item.twId);
        if (!stillAsPreviewed(now, written, backup)) {
          await fail(
            `Cena w Subiekcie zmieniła się po zapisie z cennika (teraz ${zl(now.purchase)} / ${zl(now.retail)}) — nie przywrócono, żeby nie nadpisać ręcznej zmiany.`
          );
          continue;
        }
        // Kopia bez ceny poziomu (null) — tego poziomu nie ruszamy.
        await writePrices(cfg, item.twId, backup, now, true);
        const after = await readPrices(cfg, item.twId);
        const off: string[] = [];
        const differs = (a: number | null, b: number | null) => b != null && (a == null || Math.abs(a - b) >= SAME);
        if (differs(after.purchase, backup.purchase)) off.push(`kartotekowa ${zl(after.purchase)} zamiast ${zl(backup.purchase)}`);
        if (differs(after.retail, backup.retail)) off.push(`detaliczna ${zl(after.retail)} zamiast ${zl(backup.retail)}`);
        if (off.length) {
          await finishRestoreItem({
            id: item.id,
            status: "restore_failed",
            error: `Po przywróceniu: ${off.join("; ")}`,
            afterPurchase: after.purchase,
            afterRetail: after.retail,
            restoredBy: user.id,
          });
          continue;
        }
        await finishRestoreItem({
          id: item.id,
          status: "restored",
          error: null,
          afterPurchase: after.purchase,
          afterRetail: after.retail,
          restoredBy: user.id,
        });
        restored++;
      } catch (e) {
        await fail(errorText(e, "Błąd zapisu w Subiekcie."));
      }
    }
    const left = only ? null : await getPriceListImport(importId);
    return { ok: true, processed: items.length, restored, remaining: left?.counts.restorable ?? 0 };
  } catch (e) {
    return { ok: false, error: errorText(e, "Przywracanie przerwane.") };
  } finally {
    await releaseLock(lockKey);
    revalidatePath(`${CENNIKI_PATH}/${importId}`);
  }
}

/** Przełącza host zapisu cen (test :5082 ↔ live :5080) bez zmiany env — tylko admin. */
export async function actionSetPricesHost(kind: "live" | "orders_test"): Promise<Result> {
  await requireAdminForMutation();
  if (kind !== "live" && kind !== "orders_test") return { ok: false, error: "Nieznany host." };
  try {
    await query(
      `INSERT INTO public.app_settings (key, value) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [PRICES_HOST_SETTING_KEY, JSON.stringify({ kind })]
    );
  } catch (e) {
    return { ok: false, error: errorText(e, "Nie udało się zapisać ustawienia.") };
  }
  revalidatePath(CENNIKI_PATH, "layout");
  return { ok: true };
}
