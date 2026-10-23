/**
 * Minimum zamówienia i próg darmowej dostawy dla propozycji ZD automatu (zadanie 5, TASKS.md;
 * spec §3.4, §4.1). Właściciel statusu `deferred` i `deferredReason`. Cena zakupu = kartotekowa
 * z API (`GET /products/{id}/price/catalog`), fallback cena z ostatniego ZD — `priceNet` każdej propozycji,
 * także dostawcy bez minimum i progu (jedno znaczenie pola dla panelu i KPI).
 *
 * Kolejność (przed bezpiecznikami — dodane linie też dostają flagi):
 * Linia pilna = prośba handlowca (towar pod klienta, niezależnie od tempa) albo pozycja (dostępne +
 * otwarte ZD) / tempo < cykl + czas dostawy: odłożenie przesuwa zamówienie o cały cykl, więc taki
 * towar skończyłby się przed kolejną dostawą.
 * 1. Poniżej minimum (PLN), bez linii pilnych → odłożona. Z pilnymi → idzie, powód w `notes`.
 * 2. Poniżej progu darmowej dostawy: brakuje ≤ 15% → dopełnienie (A/B, najmniej dni pokrycia,
 *    każdy towar najwyżej do celu + tempo × cykl). Nadal poniżej progu i bez pilnych → odłożona
 *    (§4.1: „ZD poniżej progu bez pilnych linii przechodzi na kolejny tydzień”); z pilnymi → idzie.
 * Linia bez ceny = wartość nieznana → reguły nie odkładają ani nie dopełniają.
 * Błąd odczytu cen / progów nigdy nie blokuje propozycji (wynik `ok`, log, powód w `notes`).
 */
import { query } from "@/lib/db/pool";
import type { ZdAutoProposalLine } from "@/lib/data/zd-auto-proposals";
import { fetchZdSupplierOrderPolicy } from "@/lib/data/zd-supplier-order-policy";
import { readZdKartotekowaPrices } from "@/lib/data/zd-kartotekowa-prices";
import { polishPluralWord } from "@/lib/email/polish-plural";
import type { ZdAbc, ZdProposalMinimumOutcome } from "@/lib/orders/zd-automat-contract";
import { isAssembledBomParent, isBomPurchaseBlockedWithoutExplode } from "@/lib/orders/zd-estimate-bom";
import { computeZdPackOrderQty } from "@/lib/orders/zd-estimate-packaging";
import { zdDocumentUnitsToPieces } from "@/lib/orders/zd-estimate-units";
import type { ZdOrderListLine } from "@/lib/orders/zd-order-list";
import { formatZdMinimumZl, isPlnCurrency, ZD_TOP_UP_MAX_GAP_SHARE } from "@/lib/orders/zd-proposal-minimum-notice";
import type { ZdProposalHookContext } from "@/lib/orders/zd-proposal-hook-context";
import { unitPricePerPiece } from "@/lib/stock-watch/analysis";

/** Brak horyzontu (czas dostawy) / cyklu w polityce — spec: cykl 7 dni. */
export const ZD_MINIMUM_DEFAULT_DAYS = 7;
/** Ceny kandydatów do dopełnienia czytane porcjami w kolejności — zwykle wystarcza pierwsza. */
const TOP_UP_PRICE_BATCH = 8;

export type ZdProposalMinimumTerms = {
  minOrderValue: number | null;
  minOrderCurrency: string | null;
  freeShippingThreshold: number | null;
};

export type ZdProposalMinimumDeps = {
  terms: ZdProposalMinimumTerms;
  cycleDays: number | null;
  /** twId → kartotekowa netto w jednostce dokumentu ZD; brak klucza = brak ceny; wyjątek = odczyt nieudany. */
  readCatalogPrices: (twIds: number[]) => Promise<ReadonlyMap<number, number>>;
  /** twId → klasa ABC (`zd_sku_class`, z korektą ręczną); pusta mapa = towary niesklasyfikowane. */
  readAbc: (twIds: number[]) => Promise<ReadonlyMap<number, ZdAbc>>;
};

export type ZdProposalMinimumResult = {
  lines: ZdAutoProposalLine[];
  outcome: ZdProposalMinimumOutcome;
  /** Powody bez zmiany statusu (idzie mimo minimum, bez dopełnienia, błąd cen) — log i testy. */
  notes: string[];
};

const round2 = (v: number) => Math.round(v * 100) / 100;
const zl = formatZdMinimumZl;

type PackagingMap = ZdProposalHookContext["engine"]["packagingLookup"];

/** Pozycja w sztukach bez tej propozycji: dostępne + otwarte ZD (para: pokrycie obu kart, ZD już w nim). */
function positionPieces(line: ZdOrderListLine["line"], packaging: PackagingMap): number {
  if (line.pair?.role === "pack") return Number(line.pair.coverSzt) || 0;
  const pack = packaging.get(line.tw_Id);
  return (Number(line.dostepne) || 0) + zdDocumentUnitsToPieces(line.otwarteZd, pack?.unitsPerPackage, pack?.documentUnitMode);
}

/** Dni pokrycia = pozycja / tempo; bez tempa — nieskończone (nic się nie kończy). */
function coverDays(line: ZdOrderListLine["line"], packaging: PackagingMap): number {
  const v = Number(line.sprzedazDziennie) || 0;
  return v > 0 ? positionPieces(line, packaging) / v : Number.POSITIVE_INFINITY;
}

const valueOf = (lines: readonly ZdAutoProposalLine[]) =>
  round2(lines.reduce((a, l) => a + (l.priceNet != null ? l.priceNet * l.pieces : 0), 0));

export async function decideZdProposalMinimum(
  ctx: ZdProposalHookContext,
  deps: ZdProposalMinimumDeps
): Promise<ZdProposalMinimumResult> {
  const notes: string[] = [];
  const ok = (lines: ZdAutoProposalLine[]): ZdProposalMinimumResult => ({ lines, outcome: { kind: "ok" }, notes });
  const min = Number(deps.terms.minOrderValue) > 0 ? Number(deps.terms.minOrderValue) : null;
  const minApplies = min != null && isPlnCurrency(deps.terms.minOrderCurrency);
  if (min != null && !minApplies) {
    notes.push(`Minimum dostawcy w ${String(deps.terms.minOrderCurrency).trim()} - reguła minimum pominięta (wartość liczona w zł).`);
  }
  const thr = Number(deps.terms.freeShippingThreshold) > 0 ? Number(deps.terms.freeShippingThreshold) : null;
  const packaging = ctx.engine.packagingLookup;
  const catalog = new Map<number, number>();
  let catalogFailed = false;
  const loadPrices = async (ids: number[]) => {
    const todo = ids.filter((id) => !catalog.has(id));
    if (!todo.length || catalogFailed) return;
    try {
      for (const [id, v] of await deps.readCatalogPrices(todo)) catalog.set(id, v);
    } catch (e) {
      catalogFailed = true;
      console.error("[zd-proposal-minimum] ceny kartotekowe", ctx.supplierId, e);
      notes.push("Ceny kartotekowe z Subiekta niedostępne - wartość z cen ostatnich ZD.");
    }
  };
  // Za sztukę, jak `priceNet` w workerze: obie ceny są w jednostce dokumentu ZD.
  const priceOf = (twId: number) =>
    unitPricePerPiece(catalog.get(twId) ?? ctx.prices.get(twId)?.priceNet ?? null, packaging.get(twId) ?? null);

  await loadPrices(ctx.lines.map((l) => l.twId));
  const lines = ctx.lines.map((l) => ({ ...l, priceNet: priceOf(l.twId) }));
  if (!minApplies && thr == null) return ok(lines);
  const unpriced = lines.filter((l) => l.priceNet == null).length;
  const value = valueOf(lines);
  if (unpriced > 0) {
    notes.push(
      `${unpriced} ${polishPluralWord(unpriced, "pozycja", "pozycje", "pozycji")} bez ceny - wartość niepełna, minimum i próg niesprawdzone.`
    );
    return ok(lines);
  }

  const listByTw = new Map(ctx.list.lines.map((l) => [l.line.tw_Id, l]));
  const cycleDays = deps.cycleDays ?? ZD_MINIMUM_DEFAULT_DAYS;
  const urgentDays = cycleDays + (ctx.horizon?.leadDays ?? ZD_MINIMUM_DEFAULT_DAYS);
  const urgent = lines.filter((l) => {
    if (l.prosbaPieces > 0) return true;
    const row = listByTw.get(l.twId);
    return row != null && coverDays(row.line, packaging) < urgentDays;
  }).length;
  const urgentWhy = `${urgent} ${polishPluralWord(urgent, "pozycja pilna", "pozycje pilne", "pozycji pilnych")} (prośba albo koniec stanu przed kolejną dostawą)`;

  if (minApplies && value < min) {
    if (!urgent) {
      return { lines, outcome: { kind: "deferred", reason: `Minimum ${zl(min)}, propozycja ${zl(value)} - przesunięta na kolejny cykl.` }, notes };
    }
    notes.push(`Poniżej minimum ${zl(min)} (${zl(value)}) - idzie, bo ${urgentWhy}.`);
  }

  if (thr != null && value < thr) {
    const gap = round2(thr - value);
    if (gap <= thr * ZD_TOP_UP_MAX_GAP_SHARE + 1e-9) {
      const top = await topUp({ ctx, lines, gap, cycleDays, deps, loadPrices, priceOf, notes });
      if (top) {
        const after = valueOf(top.lines);
        return {
          lines: top.lines,
          outcome: {
            kind: "topped_up",
            addedTwIds: top.addedTwIds,
            reason: `Dopełniona do darmowej dostawy od ${zl(thr)}: ${top.addedTwIds.length} ${polishPluralWord(top.addedTwIds.length, "pozycja", "pozycje", "pozycji")} za ${zl(after - value)} (było ${zl(value)}).`,
          },
          notes,
        };
      }
    } else {
      notes.push(`Do darmowej dostawy od ${zl(thr)} brakuje ${zl(gap)} - ponad 15%, bez dopełnienia.`);
    }
    if (!urgent) {
      return {
        lines,
        outcome: { kind: "deferred", reason: `Darmowa dostawa od ${zl(thr)}, propozycja ${zl(value)} - przesunięta na kolejny cykl.` },
        notes,
      };
    }
    notes.push(`Poniżej darmowej dostawy od ${zl(thr)} (${zl(value)}) - idzie, bo ${urgentWhy}.`);
  }
  return ok(lines);
}

/** Dopełnienie do progu; null = nie da się dojść do progu (nic nie dodajemy — to tylko mrożenie kapitału). */
async function topUp(input: {
  ctx: ZdProposalHookContext;
  lines: ZdAutoProposalLine[];
  gap: number;
  cycleDays: number;
  deps: ZdProposalMinimumDeps;
  loadPrices: (ids: number[]) => Promise<void>;
  priceOf: (twId: number) => number | null;
  notes: string[];
}): Promise<{ lines: ZdAutoProposalLine[]; addedTwIds: number[] } | null> {
  const { ctx, cycleDays, notes } = input;
  const packaging = ctx.engine.packagingLookup;
  let candidates = ctx.list.lines.filter(({ line }) => {
    const tw = line.tw_Id;
    return (
      Number(line.sprzedazDziennie) > 0 &&
      !ctx.list.orderExcludedTwIds.has(tw) &&
      !ctx.list.extraOnlyTwIds.has(tw) &&
      line.pair?.role !== "piece" &&
      !(line.pair?.role === "pack" && line.pair.partnerMissing) &&
      !isAssembledBomParent(line) &&
      !isBomPurchaseBlockedWithoutExplode(line)
    );
  });
  let abc: ReadonlyMap<number, ZdAbc> = new Map();
  try {
    abc = await input.deps.readAbc(candidates.map((c) => c.line.tw_Id));
  } catch (e) {
    console.error("[zd-proposal-minimum] klasy ABC", ctx.supplierId, e);
  }
  // Pusta klasyfikacja = bez filtra; inaczej tylko A/B (towar bez klasy też odpada).
  if (abc.size > 0) candidates = candidates.filter((c) => ["A", "B"].includes(abc.get(c.line.tw_Id) ?? ""));
  candidates.sort((a, b) => coverDays(a.line, packaging) - coverDays(b.line, packaging) || a.line.tw_Id - b.line.tw_Id);

  const out = new Map(input.lines.map((l) => [l.twId, l]));
  const added: number[] = [];
  let gap = input.gap;
  for (let i = 0; i < candidates.length && gap > 1e-9; i += TOP_UP_PRICE_BATCH) {
    const batch = candidates.slice(i, i + TOP_UP_PRICE_BATCH);
    await input.loadPrices(batch.map((c) => c.line.tw_Id));
    for (const { line } of batch) {
      if (gap <= 1e-9) break;
      const tw = line.tw_Id;
      const price = input.priceOf(tw);
      if (price == null) continue;
      const pack = packaging.get(tw);
      const pair = line.pair?.role === "pack" ? line.pair : null;
      const units = pair ? pair.unitsPerPack : pack?.unitsPerPackage;
      const mode = pair ? "packages" : pack?.documentUnitMode;
      const position = positionPieces(line, packaging);
      const cel = Number(line.celZapasuTracked ?? line.celZapasu) || 0;
      // Najwyżej jeden cykl zapasu ponad cel (S + d̄·R), liczony od pozycji bez tej propozycji.
      const capPieces = Math.ceil(cel + Number(line.sprzedazDziennie) * cycleDays - position - 1e-9);
      const current = out.get(tw);
      const curUnits = current?.zdUnits ?? 0;
      const curPieces = current?.pieces ?? 0;
      const want = Math.min(capPieces, curPieces + Math.ceil(gap / price - 1e-9));
      if (want <= curPieces) continue;
      const qty = computeZdPackOrderQty(want, units, pack?.packageLabel ?? "op.", mode, pack?.orderMultiple ?? null);
      if (qty.zdUnits <= curUnits) continue;
      gap = round2(gap - (qty.piecesArriving - curPieces) * price);
      added.push(tw);
      out.set(
        tw,
        current
          ? { ...current, zdUnits: qty.zdUnits, pieces: qty.piecesArriving, topUpUnits: (current.topUpUnits ?? 0) + qty.zdUnits - curUnits }
          : {
              twId: tw,
              symbol: line.tw_Symbol || "",
              nazwa: String(line.tw_Nazwa ?? "").trim(),
              zdUnits: qty.zdUnits,
              pieces: qty.piecesArriving,
              unitLabel: qty.hasPackaging && qty.documentUnitMode === "packages" ? pack?.packageLabel || "op." : "szt",
              priceNet: price,
              prosbaPieces: 0,
              floor: line.demandFloor != null,
              plu: String(line.tw_PLU ?? "").trim() || null,
              celAtLink: line.celZapasuTracked,
              deltaAtLink: line.salesTrackDelta,
              topUpUnits: qty.zdUnits,
            }
      );
    }
  }
  if (gap > 1e-9) {
    notes.push(`Do darmowej dostawy brakuje ${zl(input.gap)} - za mało towarów${abc.size ? " A/B" : ""} do dopełnienia.`);
    return null;
  }
  return { lines: [...out.values()], addedTwIds: added };
}

/** Podpięcie nocnego przebiegu (worker.ts): progi dostawcy, cykl, ceny kartotekowe, klasy ABC. */
export async function applyZdProposalMinimum(ctx: ZdProposalHookContext): Promise<ZdProposalMinimumResult> {
  try {
    const [termsRes, policy] = await Promise.all([
      query<{ min_order_value: string | null; min_order_currency: string | null; free_shipping_threshold: string | null }>(
        `SELECT min_order_value, min_order_currency, to_jsonb(s.*) ->> 'free_shipping_threshold' AS free_shipping_threshold
           FROM suppliers s WHERE id = $1`,
        [ctx.supplierId]
      ),
      fetchZdSupplierOrderPolicy(ctx.supplierId),
    ]);
    const t = termsRes.rows[0];
    let requests = 0;
    const result = await decideZdProposalMinimum(ctx, {
      terms: {
        minOrderValue: t?.min_order_value != null ? Number(t.min_order_value) : null,
        minOrderCurrency: t?.min_order_currency ?? null,
        freeShippingThreshold: t?.free_shipping_threshold != null ? Number(t.free_shipping_threshold) : null,
      },
      cycleDays: policy.cycleDays,
      readCatalogPrices: async (ids) => {
        const r = await readZdKartotekowaPrices(ids);
        requests += r.requests;
        return r.prices;
      },
      readAbc: async (ids) => {
        const res = await query<{ subiekt_tw_id: number; abc: ZdAbc }>(
          `SELECT subiekt_tw_id, coalesce(override_abc, abc) AS abc FROM zd_sku_class WHERE subiekt_tw_id = ANY($1::int[])`,
          [ids]
        );
        return new Map(res.rows.map((r) => [Number(r.subiekt_tw_id), r.abc]));
      },
    });
    if (requests || result.outcome.kind !== "ok" || result.notes.length) {
      console.info("[zd-proposal-minimum]", ctx.supplierId, result.outcome.kind, `ceny: ${requests} zapytań`, result.notes.join(" | "));
    }
    return result;
  } catch (e) {
    console.error("[zd-proposal-minimum]", ctx.supplierId, e);
    return { lines: ctx.lines, outcome: { kind: "ok" }, notes: ["Minimum i próg niesprawdzone - błąd odczytu progów dostawcy."] };
  }
}
