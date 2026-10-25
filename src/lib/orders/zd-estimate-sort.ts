import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import {
  effectiveZdDocumentUnits,
  individualExtraPiecesForTw,
} from "@/lib/orders/zd-estimate-packaging";

export type ZdEstimateListSortKey =
  | "symbol"
  | "name"
  | "doZd"
  | "confidence"
  | "minStock"
  /** Dni do wyczerpania (dostępne / sprzedaż dziennie) — rosnąco = najpilniejsze. */
  | "cover"
  /** Klasa ABC (zysk 12 mies.) — rosnąco = A najpierw, w klasie największe „Do ZD” (kolejność przeglądu, spec §8.2). */
  | "abc";
export type ZdEstimateListSortDir = "asc" | "desc";

export type ZdEstimateSortPackaging = {
  unitsPerPackage: number;
  packageLabel?: string;
  documentUnitMode?: import("@/lib/orders/zd-estimate-units").ZdPackagingDocumentUnitMode | null;
};

/**
 * Dni do wyczerpania: dostępne / sprzedaż dziennie. Brak dostępnego = 0,
 * brak sprzedaży = null (nie kończy się).
 * Para (wiersz paczki): sprzedaż jest łączna w sztukach, więc dostępne też w sztukach —
 * sztuki + paczki × przelicznik (bez otwartych ZD, jak przy zwykłym towarze).
 */
/** Dostępne w sztukach — dla pary sztuki + paczki × przelicznik (wiersz paczki ma `dostepne` w paczkach). */
export function zdLineAvailablePieces(
  line: Pick<ManualZdEstimateLine, "dostepne"> & Partial<Pick<ManualZdEstimateLine, "pair">>
): number {
  const pair = line.pair?.role === "pack" && !line.pair.partnerMissing ? line.pair : null;
  return pair
    ? (Number(pair.pieceDostepne) || 0) + (Number(pair.packDostepne) || 0) * Math.max(1, Number(pair.unitsPerPack) || 1)
    : Number(line.dostepne) || 0;
}

export function zdEstimateDaysOfCover(
  line: Pick<ManualZdEstimateLine, "dostepne" | "sprzedazDziennie"> & Partial<Pick<ManualZdEstimateLine, "pair">>
): number | null {
  const available = zdLineAvailablePieces(line);
  const daily = Number(line.sprzedazDziennie) || 0;
  if (available <= 0) return daily > 0 ? 0 : null;
  if (daily <= 0) return null;
  return available / daily;
}

function zdEstimateDaysOfCoverSortValue(
  line: Pick<ManualZdEstimateLine, "dostepne" | "sprzedazDziennie"> & Partial<Pick<ManualZdEstimateLine, "pair">>
): number {
  return zdEstimateDaysOfCover(line) ?? Number.POSITIVE_INFINITY;
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, "pl", { numeric: true, sensitivity: "base" });
}

/**
 * Sortuje widoczne linie szacunku (kopia tablicy).
 * „Do ZD” = jednostki dokumentu (z nadpisaniem sesji jeśli podane).
 */
export function sortZdEstimateLines(
  lines: readonly ManualZdEstimateLine[],
  sortKey: ZdEstimateListSortKey,
  sortDir: ZdEstimateListSortDir,
  packagingById?: ReadonlyMap<number, ZdEstimateSortPackaging> | null,
  individualExtraByTwId?: ReadonlyMap<number, number> | null,
  qtyOverrideByTwId?: ReadonlyMap<number, number> | null,
  extraOnlyTwIds?: ReadonlySet<number> | null,
  extrasPolicy?: import("@/lib/orders/zd-estimate-extras-policy").ZdEstimateExtrasPolicy,
  stockNeedReliefByTwId?: ReadonlyMap<number, number> | null,
  extraOverlapByTwId?: ReadonlyMap<number, number> | null,
  minStockByTwId?: ReadonlyMap<number, number> | null,
  /** twId → klasa ABC (`zd_sku_class`, z nadpisaniem); brak = towar niesklasyfikowany (na końcu). */
  abcByTwId?: ReadonlyMap<number, string> | null
): ManualZdEstimateLine[] {
  const dir = sortDir === "asc" ? 1 : -1;
  const pack = packagingById ?? null;
  const doZd = (l: ManualZdEstimateLine) =>
    effectiveZdDocumentUnits(
      l,
      pack?.get(l.tw_Id) ?? null,
      individualExtraPiecesForTw(l.tw_Id, individualExtraByTwId),
      qtyOverrideByTwId?.get(l.tw_Id),
      extraOnlyTwIds?.has(l.tw_Id) === true,
      extrasPolicy,
      individualExtraPiecesForTw(l.tw_Id, stockNeedReliefByTwId),
      individualExtraPiecesForTw(l.tw_Id, extraOverlapByTwId),
      individualExtraPiecesForTw(l.tw_Id, minStockByTwId)
    );
  const abcRank = (l: ManualZdEstimateLine) => ZD_ABC_RANK[abcByTwId?.get(l.tw_Id) ?? ""] ?? 3;

  return [...lines].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "abc") {
      // Niesklasyfikowane zawsze na końcu; w klasie największe „Do ZD” najpierw — niezależnie od kierunku.
      const ra = abcRank(a);
      const rb = abcRank(b);
      if (ra === 3 || rb === 3) {
        if (ra !== rb) return ra - rb;
      } else if (ra !== rb) {
        return dir * (ra - rb);
      }
      const q = doZd(b) - doZd(a);
      return q !== 0 ? q : compareText(a.tw_Symbol, b.tw_Symbol);
    }
    if (sortKey === "symbol") {
      cmp = compareText(a.tw_Symbol, b.tw_Symbol);
    } else if (sortKey === "name") {
      cmp = compareText(a.tw_Nazwa, b.tw_Nazwa);
    } else if (sortKey === "confidence") {
      cmp =
        (Number(a.salesTrackConfidence) || 0) -
        (Number(b.salesTrackConfidence) || 0);
    } else if (sortKey === "cover") {
      const ca = zdEstimateDaysOfCoverSortValue(a);
      const cb = zdEstimateDaysOfCoverSortValue(b);
      // Oba „nie kończy się” (Infinity) — remis, nie NaN.
      cmp = ca === cb ? 0 : ca < cb ? -1 : 1;
    } else if (sortKey === "minStock") {
      const ma = minStockByTwId?.get(a.tw_Id) ?? 0;
      const mb = minStockByTwId?.get(b.tw_Id) ?? 0;
      cmp = ma - mb;
    } else {
      cmp = doZd(a) - doZd(b);
    }
    if (cmp !== 0) return dir * cmp;
    return compareText(a.tw_Symbol, b.tw_Symbol);
  });
}

const ZD_ABC_RANK: Record<string, number> = { A: 0, B: 1, C: 2 };

/** Przy zmianie kolumny: tekst A→Z, Do ZD / pewność od największej. */
export function defaultDirForZdEstimateSortKey(
  key: ZdEstimateListSortKey
): ZdEstimateListSortDir {
  return key === "doZd" || key === "confidence" || key === "minStock"
    ? "desc"
    : "asc";
}
