"use server";

// Autoryzacja: podgląd i zaznaczanie — requireOperations(); zapis do Subiekta — tylko admin
// (requireAdminForMutation). Zapis cen tylko na hoście SUBIEKT_API_PRICES_BASE_URL.

import { revalidatePath } from "next/cache";
import { requireAdminForMutation, requireOperations } from "@/lib/auth";
import { readSpreadsheetSheets, isSpreadsheetFile } from "@/lib/customs/customs-spreadsheet";
import {
  comparePrices,
  detectPriceListColumns,
  firstHeaderRow,
  normalizeSymbol,
  parsePriceListRows,
  PRICE_LIST_COLUMN_LABEL,
  priceHardBlock,
  type PriceListRow,
} from "@/lib/price-lists/price-list";
import {
  fetchCechaProducts,
  fetchCechaVat,
  getPricesHost,
  hasExactPricesEndpoint,
  readPrices,
  readPricesMany,
  searchPriceCechy,
  writePrices,
} from "@/lib/price-lists/subiekt-prices";
import {
  finishPriceItem,
  getPriceItems,
  getPriceListImport,
  insertPriceListImport,
  nextSelectedPending,
  retryFailedPriceItems,
  setPriceItemsSelected,
  type NewPriceListItem,
} from "@/lib/price-lists/data";
import { tryAcquireLock, releaseLock } from "@/lib/services/locks";

const CENNIKI_PATH = "/zakupy/cenniki";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_THRESHOLD_PCT = 5;
/** ~1,5 s na pozycję (odczyt + zapis Sferą + odczyt) — partia mieści się w limicie żądania. */
const APPLY_CHUNK = 20;
const SAME = 0.005;

const zl = (v: number | null) => (v == null ? "brak" : v.toFixed(2).replace(".", ","));

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function errorText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export type PriceCechaOption = { id: number; name: string };

export async function actionSearchPriceCechy(search: string): Promise<Result<{ cechy: PriceCechaOption[] }>> {
  await requireOperations("read");
  const host = getPricesHost();
  if (!host.ok) return { ok: false, error: host.error };
  try {
    const rows = await searchPriceCechy(host.host.config, search);
    return { ok: true, cechy: rows.map((c) => ({ id: c.ctw_Id, name: String(c.ctw_Nazwa ?? c.ctw_Id) })) };
  } catch (e) {
    return { ok: false, error: errorText(e, "Nie udało się pobrać cech z Subiekta.") };
  }
}

/**
 * Wgrany cennik → porównanie z cenami towarów cechy dostawcy → zapis podglądu w bazie.
 * Nic nie zmienia w Subiekcie.
 */
export async function actionPreparePriceList(formData: FormData): Promise<Result<{ id: string }>> {
  const user = await requireOperations("mutate");
  const host = getPricesHost();
  if (!host.ok) return { ok: false, error: host.error };
  const cfg = host.host.config;

  const file = formData.get("file");
  const cechaId = Number(formData.get("cechaId"));
  const cechaNameHint = String(formData.get("cechaName") ?? "").trim();
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Wybierz plik cennika." };
  if (file.size > MAX_FILE_SIZE) return { ok: false, error: "Plik jest większy niż 10 MB." };
  if (!isSpreadsheetFile(file.name, file.type)) return { ok: false, error: "Cennik musi być plikiem Excel lub CSV." };
  if (!Number.isInteger(cechaId) || cechaId <= 0 || !cechaNameHint) return { ok: false, error: "Wybierz cechę dostawcy." };
  // Nazwa cechy z Subiektu, nie z formularza — do historii trafia to, co naprawdę porównano.
  let cechaName: string;
  try {
    const found = (await searchPriceCechy(cfg, cechaNameHint)).find((c) => c.ctw_Id === cechaId);
    if (!found) return { ok: false, error: "Wybrana cecha nie istnieje w Subiekcie. Wybierz ją ponownie z listy." };
    cechaName = String(found.ctw_Nazwa ?? found.ctw_Id);
  } catch (e) {
    return { ok: false, error: errorText(e, "Nie udało się sprawdzić cechy w Subiekcie.") };
  }

  let parsed: { rows: PriceListRow[]; validFrom: string | null };
  let columns;
  try {
    const sheets = await readSpreadsheetSheets(Buffer.from(await file.arrayBuffer()), file.name);
    const sheet = sheets.find((s) => detectPriceListColumns(s));
    columns = sheet ? detectPriceListColumns(sheet) : null;
    if (!sheet || !columns) {
      const headers = firstHeaderRow(sheets[0] ?? []);
      return {
        ok: false,
        error: `Nie rozpoznano kolumn cennika. Potrzebne: ${PRICE_LIST_COLUMN_LABEL.symbol} i co najmniej jedna cena netto. Nagłówki w pliku: ${headers.join(" · ") || "brak"}.`,
      };
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
    const matched = products.filter((p) => bySymbol.has(normalizeSymbol(p.tw_Symbol)));
    const prices = await readPricesMany(cfg, matched.map((p) => p.tw_Id));

    const items: NewPriceListItem[] = products.map((p) => {
      const symbol = normalizeSymbol(p.tw_Symbol);
      const name = String(p.tw_Nazwa ?? "").trim();
      const listRows = bySymbol.get(symbol);
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
      const old = prices.get(p.tw_Id)!;
      const cmp = comparePrices({
        list,
        subiekt: { name, purchase: old.purchase, retail: old.retail, vat: base.vatSubiekt },
        thresholdPct: DEFAULT_THRESHOLD_PCT,
        duplicate: listRows.length > 1 || (symbolCount.get(symbol) ?? 0) > 1,
      });
      return {
        ...base,
        listName: list.name || null,
        listRow: list.row,
        packFactor: cmp.packFactor,
        vatList: list.vat,
        listDiscount: list.discount,
        oldPurchase: old.purchase,
        oldRetail: old.retail,
        newPurchase: cmp.newPurchase,
        newRetail: cmp.newRetail,
        flags: cmp.flags,
        selected: cmp.selected,
        status: "pending" as const,
      };
    });

    const matchedSymbols = new Set(matched.map((p) => normalizeSymbol(p.tw_Symbol)));
    const id = await insertPriceListImport({
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
    });
    revalidatePath(CENNIKI_PATH);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: errorText(e, "Nie udało się porównać cennika z Subiektem.") };
  }
}

export async function actionSetPriceItemsSelected(
  importId: string,
  ids: number[],
  selected: boolean
): Promise<Result<{ skipped: { symbol: string; reason: string }[] }>> {
  await requireOperations("mutate");
  try {
    let valid = Array.isArray(ids) ? ids.filter(Number.isInteger) : [];
    const skipped: { symbol: string; reason: string }[] = [];
    if (selected) {
      const blocked = new Set<number>();
      for (const item of await getPriceItems(importId, valid)) {
        const reason = priceHardBlock(item);
        if (reason) {
          blocked.add(item.id);
          skipped.push({ symbol: item.symbol, reason });
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
  const host = getPricesHost();
  if (!host.ok) return { ok: false, error: host.error };
  const imp = await getPriceListImport(importId);
  if (!imp) return { ok: false, error: "Nie ma takiego cennika." };
  if (imp.hostKind !== host.host.hostKind) {
    return {
      ok: false,
      error: `Cennik przygotowano na innym Subiekcie (${imp.hostKind === "live" ? "LIVE" : "test"}), a OnTime wskazuje teraz ${host.host.label}. Wgraj cennik ponownie.`,
    };
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
        if (differs(now.purchase, expected.purchase) || differs(now.retail, expected.retail)) {
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
        await writePrices(cfg, item.twId, target, expected, exact);
        const after = await readPrices(cfg, item.twId);
        const off: string[] = [];
        if (target.purchase != null && differs(after.purchase, target.purchase)) {
          off.push(`kartotekowa ${zl(after.purchase)} zamiast ${zl(target.purchase)}`);
        }
        if (target.retail != null && differs(after.retail, target.retail)) {
          off.push(
            `detaliczna ${zl(after.retail)} zamiast ${zl(target.retail)}${exact ? "" : " (API przelicza narzutem — czeka na PUT /products/{id}/prices)"}`
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
