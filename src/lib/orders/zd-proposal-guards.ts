/**
 * Bezpieczniki linii propozycji ZD automatu (zadanie 4, TASKS.md; spec §3.5).
 * Właściciel znaczenia `ZdAutoProposalLine.flags` i `ZdProposalFlag` (zd-automat-contract.ts).
 *
 * Flagi tylko oznaczają linię do sprawdzenia przez człowieka — ilości się nie zmieniają.
 * Reguły to czyste funkcje (testy na granicach); I/O w `zd-proposal-guard-inputs.ts`.
 * Błąd danych nigdy nie blokuje propozycji: linia, której nie dało się sprawdzić, dostaje `missing_data`.
 */
import type { ZdAutoProposalLine } from "@/lib/data/zd-auto-proposals";
import {
  fetchZdGuardPeakDocs,
  loadZdProposalGuardInputs,
  type ZdGuardSaleDoc,
} from "@/lib/data/zd-proposal-guard-inputs";
import type { ZdProposalFlag, ZdProposalLineFlag } from "@/lib/orders/zd-automat-contract";
import { sales90FromProfile } from "@/lib/orders/zd-demand-policy";
import { formatQty, zdEstimateWindowDays } from "@/lib/orders/zd-estimate-manual";
import type { ZdProposalHookContext } from "@/lib/orders/zd-proposal-hook-context";
import { resolveStockWatchBomViews, resolveStockWatchLineFigures } from "@/lib/stock-watch/bom-stock";
import { mapPool } from "@/lib/async/map-pool";

/** Sufit: zapas po dostawie najwyżej na dni celu + tyle dni tempa. */
export const ZD_GUARD_CEILING_EXTRA_DAYS = 30;
/** Pik: jeden dokument ponad taki udział sprzedaży 30 d… */
export const ZD_GUARD_PEAK_DOC_SHARE = 0.6;
/** …i ilość ponad tyle × (tempo 90 d × dni celu). */
export const ZD_GUARD_PEAK_QTY_FACTOR = 2;
export const ZD_GUARD_PEAK_WINDOW_DAYS = 30;
/**
 * Pik tylko dla towarów, które rotują: przy rzadkiej sprzedaży jeden dokument to zawsze ~100%.
 * Próg sztuk jak „skok” profilu 12 okien (docs/zamowienia-jeden-silnik.md §3.3a); wartość — gdy jest cena.
 */
export const ZD_GUARD_PEAK_MIN_SALES_30D = 5;
export const ZD_GUARD_PEAK_MIN_LINE_VALUE = 200;
/** Skok: ilość ponad tyle × średnia z ostatnich ZD towaru u dostawcy. */
export const ZD_GUARD_JUMP_FACTOR = 3;
export const ZD_GUARD_JUMP_HISTORY = 4;
export const ZD_GUARD_JUMP_MIN_HISTORY = 2;
/** Nowość: pierwsza sprzedaż w ostatnich 3 oknach profilu (≈ 13 tygodni) i wartość linii ponad tyle zł. */
export const ZD_GUARD_NEW_ITEM_WINDOWS = 3;
export const ZD_GUARD_NEW_ITEM_MIN_VALUE = 500;
/** Wartość ZD: ponad tyle × mediana ostatnich ZD dostawcy. */
export const ZD_GUARD_ORDER_VALUE_FACTOR = 2;
export const ZD_GUARD_ORDER_VALUE_HISTORY = 6;
export const ZD_GUARD_ORDER_VALUE_MIN_HISTORY = 3;
/** …i tylko od takiej wartości (zł): przy małych ZD „2× mediany” to kilkaset złotych, nie sygnał. */
export const ZD_GUARD_ORDER_VALUE_MIN_ZL = 2000;
/** Najwyżej tyle linii pyta Subiekta o dokumenty sprzedaży (pik); reszta kandydatów = `missing_data`. */
export const ZD_GUARD_PEAK_MAX_FETCHES = 40;
export const ZD_GUARD_PEAK_CONCURRENCY = 4;

/** Liczby jednej linii, z których liczą się reguły (sztuki karty, dni kalendarzowe). */
export type ZdGuardLineFacts = {
  pieces: number;
  /** Z tego sztuki z próśb — zamówione pod klienta, nie na zapas (bez sufitu i piku). */
  prosbaPieces: number;
  zdUnits: number;
  priceNet: number | null;
  /** Dzienne tempo, z którego liczył silnik (po podłodze 90 d); null = brak. */
  tempo: number | null;
  /** Średnia dzienna z 90 d (profil); null = brak profilu. */
  tempo90: number | null;
  available: number;
  openZd: number;
  /** Minimum z Kreatora (sztuki) — świadomy zapas, sufit go nie podcina. */
  minStock: number | null;
  /** Profil 12 × 30 d, od najstarszego; null = brak. */
  windows: readonly number[] | null;
  /** Jednostki ZD z ostatnich ZD towaru u dostawcy, najnowsze pierwsze. */
  recentZdUnits: readonly number[];
};

/** Udział największego dokumentu w sprzedaży okna (dokumenty z kilku pozycji sumowane; ZW odejmuje). */
export function zdPeakDocShare(docs: readonly ZdGuardSaleDoc[]): { maxDoc: number; total: number } {
  const byDoc = new Map<number, number>();
  let total = 0;
  for (const d of docs) {
    total += d.qty;
    if (d.qty > 0) byDoc.set(d.dokId, (byDoc.get(d.dokId) ?? 0) + d.qty);
  }
  return { maxDoc: Math.max(0, ...byDoc.values()), total };
}

const stockPieces = (f: ZdGuardLineFacts) => Math.max(0, f.pieces - Math.max(0, f.prosbaPieces));

/** Sprzedaż z ostatniego okna profilu (30 d); null = brak profilu. */
const sales30 = (f: ZdGuardLineFacts) => (f.windows?.length ? Math.max(0, f.windows[f.windows.length - 1] ?? 0) : null);

/**
 * Kandydat na pik: towar rotuje (sprzedaż 30 d ≥ 5 szt, linia ≥ 200 zł, gdy jest cena) i ilość
 * ponad 2× tempo 90 d × dni celu. Tylko te linie pytają Subiekta o dokumenty.
 */
export function zdPeakCandidate(f: ZdGuardLineFacts, dniZapasu: number): boolean {
  const s30 = sales30(f);
  if (f.tempo90 == null || s30 == null || s30 < ZD_GUARD_PEAK_MIN_SALES_30D) return false;
  if (f.priceNet != null && f.priceNet * f.pieces < ZD_GUARD_PEAK_MIN_LINE_VALUE) return false;
  return stockPieces(f) > ZD_GUARD_PEAK_QTY_FACTOR * f.tempo90 * dniZapasu;
}

export function zdIsNewItem(windows: readonly number[] | null): boolean {
  if (!windows || windows.length < ZD_GUARD_NEW_ITEM_WINDOWS + 1) return false;
  const cut = windows.length - ZD_GUARD_NEW_ITEM_WINDOWS;
  return windows.slice(0, cut).every((v) => !(v > 0)) && windows.slice(cut).some((v) => v > 0);
}

export function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

type ZdLineGuardResult = { flags: ZdProposalLineFlag[]; notes: Partial<Record<ZdProposalLineFlag, string>> };

const qty = (n: number) => formatQty(Math.round(n * 10) / 10);
/** Tempo czytelnie: „3 szt/d”, a przy wolnej rotacji „1 szt / 60 d” zamiast „0 szt/d”. */
const tempoText = (t: number) => (t > 0 && t < 0.1 ? `1 szt / ${Math.round(1 / t)} d` : `${qty(t)} szt/d`);
const zl = (n: number) => `${Math.round(n).toLocaleString("pl-PL")} zł`;

/**
 * Flagi jednej linii i krótkie notatki z liczbami (sztuki karty, zł) do dymka w panelu.
 * `peak`: dokumenty sprzedaży 30 d — null = nie pytano (ilość nie przekroczyła progu),
 * "error" = zapytanie nie wyszło.
 */
export function zdLineGuardFlags(
  f: ZdGuardLineFacts,
  input: { dniZapasu: number; hasHorizon: boolean; peak: { maxDoc: number; total: number } | null | "error" }
): ZdLineGuardResult {
  const out: ZdLineGuardResult = { flags: [], notes: {} };
  const add = (flag: ZdProposalLineFlag, note: string) => {
    out.flags.push(flag);
    out.notes[flag] = note;
  };
  const dni = input.dniZapasu;
  const stock = stockPieces(f);
  if (f.tempo != null) {
    const byTempo = f.tempo * (dni + ZD_GUARD_CEILING_EXTRA_DAYS);
    const ceiling = Math.max(byTempo, f.minStock ?? 0);
    const after = f.available + f.openZd + stock;
    // Jedna jednostka zamówienia (sztuka albo opakowanie) mniej musi nadal przekraczać sufit — inaczej
    // to tylko zaokrąglenie do całej sztuki / paczki (wolno rotujący towar zawsze „przekroczy” ułamek).
    const step = f.zdUnits > 0 ? f.pieces / f.zdUnits : 1;
    if (stock > 0 && after - step > ceiling) {
      add(
        "ceiling",
        `Stan, otwarte ZD i zamówienie: ${qty(after)} szt > sufit ${qty(ceiling)} szt ` +
          (ceiling > byTempo ? "(minimum z Kreatora)." : `(tempo ${tempoText(f.tempo)} × ${dni + ZD_GUARD_CEILING_EXTRA_DAYS} d).`)
      );
    }
  }
  const p = input.peak;
  if (p && p !== "error" && p.total > 0 && p.maxDoc > ZD_GUARD_PEAK_DOC_SHARE * p.total && zdPeakCandidate(f, dni)) {
    add(
      "peak",
      `Jeden dokument to ${Math.round((p.maxDoc / p.total) * 100)}% z ${qty(p.total)} szt sprzedaży 30 d; zamówienie ${qty(stock)} szt > ` +
        `${qty(ZD_GUARD_PEAK_QTY_FACTOR * f.tempo90! * dni)} szt (2× tempo 90 d × ${dni} d).`
    );
  }
  const hist = f.recentZdUnits.slice(0, ZD_GUARD_JUMP_HISTORY);
  if (hist.length >= ZD_GUARD_JUMP_MIN_HISTORY) {
    const avg = hist.reduce((a, x) => a + x, 0) / hist.length;
    if (f.zdUnits > ZD_GUARD_JUMP_FACTOR * avg) {
      add("jump", `Zamówienie ${qty(f.zdUnits)} > 3× średnia ${qty(avg)} z ${hist.length} ostatnich ZD tego towaru.`);
    }
  }
  if (f.priceNet != null && f.priceNet * f.pieces > ZD_GUARD_NEW_ITEM_MIN_VALUE && zdIsNewItem(f.windows)) {
    add("new_item", `Pierwsza sprzedaż mniej niż 13 tygodni temu; pozycja warta ${zl(f.priceNet * f.pieces)}.`);
  }
  const missing = [
    f.tempo == null ? "tempa sprzedaży" : null,
    f.priceNet == null ? "ceny zakupu" : null,
    input.hasHorizon ? null : "czasu dostawy",
    p === "error" ? "dokumentów sprzedaży z Subiekta" : null,
  ].filter(Boolean);
  if (missing.length) add("missing_data", `Brak: ${missing.join(", ")}.`);
  return out;
}

/** Wartość propozycji ponad 2× mediana ostatnich ZD dostawcy (najnowsze pierwsze; < 3 ZD = bez flagi). */
export function zdOrderValueJump(value: number, recentOrderValues: readonly number[]): boolean {
  const hist = recentOrderValues.slice(0, ZD_GUARD_ORDER_VALUE_HISTORY);
  if (hist.length < ZD_GUARD_ORDER_VALUE_MIN_HISTORY) return false;
  return value > ZD_GUARD_ORDER_VALUE_MIN_ZL && value > ZD_GUARD_ORDER_VALUE_FACTOR * median(hist);
}

const withFlags = (l: ZdAutoProposalLine, r: ZdLineGuardResult): ZdAutoProposalLine =>
  r.flags.length ? { ...l, flags: r.flags, flagNotes: r.notes } : l;
const missingData = (note: string): ZdLineGuardResult => ({ flags: ["missing_data"], notes: { missing_data: note } });

/** Okno piku: 30 dni kalendarzowych kończące się na `dataDo` (włącznie). */
export function zdPeakWindow(dataDo: string): { dataOd: string; dataDo: string } {
  const d = new Date(`${dataDo}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (ZD_GUARD_PEAK_WINDOW_DAYS - 1));
  return { dataOd: d.toISOString().slice(0, 10), dataDo };
}

/** Liczby linii z wyniku silnika — te same co Braki w workerze (pary i składy jak tam). */
function engineFacts(ctx: ZdProposalHookContext) {
  const { engine } = ctx;
  const pozycje = engine.result.pozycje;
  const cardPackaging = new Map(
    engine.packaging.map((row) => [
      row.subiektTwId,
      { unitsPerPackage: row.unitsPerPackage, documentUnitMode: row.documentUnitMode },
    ])
  );
  const dniOkresu = zdEstimateWindowDays(engine.result.parametry) ?? NaN;
  const bomViews = resolveStockWatchBomViews({
    byTw: new Map(pozycje.map((l) => [l.tw_Id, l])),
    boms: engine.bomRefs,
    packagingByTwId: cardPackaging,
    dniOkresu: Number.isFinite(dniOkresu) && dniOkresu > 0 ? dniOkresu : null,
    fallbackDniOkresu: ctx.dniZapasuUsed,
  });
  const listByTw = new Map(ctx.list.lines.map((l) => [l.line.tw_Id, l.line]));
  return (twId: number) => {
    const line = listByTw.get(twId);
    if (!line) return null;
    const fig = resolveStockWatchLineFigures(line, bomViews.get(twId) ?? null, cardPackaging.get(twId) ?? null);
    const tempo = Number.isFinite(fig.velocityDaily) ? fig.velocityDaily : null;
    const sales90 = line.demandFloor?.sales90 ?? sales90FromProfile(line.salesProfile?.windows);
    return {
      tempo,
      tempo90: sales90 != null && Number.isFinite(sales90) ? sales90 / 90 : null,
      available: fig.availableQty,
      openZd: fig.openZdQty,
      minStock: engine.minStockByTwId.get(twId) ?? null,
      windows: line.salesProfile?.windows ?? null,
    };
  };
}

export async function applyZdProposalGuards(
  ctx: ZdProposalHookContext
): Promise<{ lines: ZdAutoProposalLine[]; proposalFlags: ZdProposalFlag[] }> {
  try {
    const twIds = ctx.lines.map((l) => l.twId);
    const factsOf = engineFacts(ctx);
    const inputs = await loadZdProposalGuardInputs({
      supplierId: ctx.supplierId,
      twIds,
      zdPerTw: ZD_GUARD_JUMP_HISTORY,
      supplierZd: ZD_GUARD_ORDER_VALUE_HISTORY,
    });
    const facts = ctx.lines.map((l): ZdGuardLineFacts | null => {
      const e = factsOf(l.twId);
      if (!e) return null;
      return {
        ...e,
        windows: e.windows ?? inputs.profileWindowsByTw.get(l.twId) ?? null,
        pieces: l.pieces,
        prosbaPieces: l.prosbaPieces,
        zdUnits: l.zdUnits,
        priceNet: l.priceNet,
        recentZdUnits: inputs.recentZdUnitsByTw.get(l.twId) ?? [],
      };
    });
    // Pik: Subiekt tylko dla linii, które przekroczyły próg ilości (zwykle kilka na dostawcę).
    const peakIdx = facts.flatMap((f, i) => (f && zdPeakCandidate(f, ctx.dniZapasuUsed) ? [i] : []));
    const peak = new Map<number, { maxDoc: number; total: number } | "error">();
    const window = zdPeakWindow(ctx.dataDo);
    await mapPool(peakIdx.slice(0, ZD_GUARD_PEAK_MAX_FETCHES), ZD_GUARD_PEAK_CONCURRENCY, async (i) => {
      const docs = await fetchZdGuardPeakDocs({ towarId: ctx.lines[i]!.twId, ...window }).catch((e) => {
        console.error("[zd-guards] dokumenty sprzedaży", ctx.lines[i]!.twId, e);
        return null;
      });
      peak.set(i, docs ? zdPeakDocShare(docs) : "error");
    });
    for (const i of peakIdx.slice(ZD_GUARD_PEAK_MAX_FETCHES)) peak.set(i, "error");

    const lines = ctx.lines.map((l, i) => {
      const f = facts[i];
      if (!f) return withFlags(l, missingData("Towaru nie ma na liście silnika - ilości nie dało się sprawdzić."));
      return withFlags(l, zdLineGuardFlags(f, { dniZapasu: ctx.dniZapasuUsed, hasHorizon: ctx.horizon != null, peak: peak.get(i) ?? null }));
    });
    const value = ctx.lines.reduce((a, l) => a + (l.priceNet != null ? l.priceNet * l.pieces : 0), 0);
    return {
      lines,
      proposalFlags: zdOrderValueJump(value, inputs.recentOrderValues) ? ["order_value_jump"] : [],
    };
  } catch (e) {
    // Propozycja powstaje dalej — bez sprawdzenia każda linia idzie do człowieka.
    console.error("[zd-guards] bezpieczniki", ctx.supplierId, e);
    return { lines: ctx.lines.map((l) => withFlags(l, missingData("Nie udało się odczytać danych bezpieczników."))), proposalFlags: [] };
  }
}
