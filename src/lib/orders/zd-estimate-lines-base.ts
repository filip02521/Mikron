/**
 * `pozycjeBase` musi być pre-BOM/pairs. Gdy UI / sesja poda już zmergowane
 * linie jako base, odzyskujemy własne kanały sprzedaży (bez ponownego wkładu).
 *
 * Kolejność odzysku: kanał pary (pack/piece) → odejmij wkład BOM jeśli
 * `pair` i `bom` współistnieją (pack/piece bywa też składnikiem).
 */

import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";

function asNum(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function zdEstimateLinesLookMerged(
  lines: readonly ManualZdEstimateLine[]
): boolean {
  return lines.some((l) => l.bom != null || l.pair != null);
}

/**
 * Zwraca kopię linii bez meta pair/BOM i z odzyskaną sprzedażą własną.
 * Bezpieczne do ponownego `refreshZdEstimateLinesWithPairs` / Policz fallback.
 */
export function coerceZdEstimateLinesBase(
  lines: readonly ManualZdEstimateLine[]
): ManualZdEstimateLine[] {
  if (!zdEstimateLinesLookMerged(lines)) {
    return lines.map((l) => ({ ...l, bom: null, pair: null }));
  }

  return lines.map((l) => {
    if (l.pair) {
      let ownSales =
        l.pair.role === "pack" ? l.pair.packSprzedaz : l.pair.pieceSprzedaz;
      let ownWz =
        l.pair.role === "pack"
          ? l.pair.packWzNiepowiazane
          : l.pair.pieceWzNiepowiazane;
      // Stan z meta pary (stan karty w momencie merge) — nie merged coverSzt.
      let dostepne =
        l.pair.role === "pack" ? l.pair.packDostepne : l.pair.pieceDostepne;

      if (l.bom?.role === "component") {
        // packSprzedaz/pieceSprzedaz są już po expand — odejmij wkład.
        ownSales = Math.max(0, asNum(ownSales) - asNum(l.bom.contributionSales));
        ownWz = Math.max(0, asNum(ownWz) - asNum(l.bom.contributionWz));
        dostepne = asNum(dostepne) - asNum(l.bom.contributionCover);
      } else if (l.bom?.role === "assembled_parent") {
        // Zestaw będący też stroną pary — przywróć sprzedaż zestawu z relocated*.
        const relocated = Math.max(0, asNum(l.bom.relocatedSales));
        const relocatedWz = Math.max(0, asNum(l.bom.relocatedWz));
        if (relocated > 0) ownSales = relocated;
        if (relocatedWz > 0 || relocated > 0) ownWz = relocatedWz;
      } else if (
        l.bom?.role === "purchased_kit" &&
        l.bom.kitOwnSales != null
      ) {
        ownSales = Math.max(0, asNum(l.bom.kitOwnSales));
        ownWz = Math.max(0, asNum(l.bom.kitOwnWz));
      }

      const sprzedazOkres = Math.max(0, asNum(ownSales));
      const wz = Math.min(Math.max(0, asNum(ownWz)), sprzedazOkres);
      return {
        ...l,
        pair: null,
        bom: null,
        sprzedazOkres,
        wzNiepowiazaneOkres: wz,
        dostepne: asNum(dostepne),
      };
    }

    if (l.bom?.role === "component") {
      const contrib = Math.max(0, asNum(l.bom.contributionSales));
      const contribWz = Math.max(0, asNum(l.bom.contributionWz));
      const contribCover = Math.max(0, asNum(l.bom.contributionCover));
      const sprzedazOkres = Math.max(0, asNum(l.sprzedazOkres) - contrib);
      const wz = Math.min(
        Math.max(0, asNum(l.wzNiepowiazaneOkres) - contribWz),
        sprzedazOkres
      );
      return {
        ...l,
        pair: null,
        bom: null,
        sprzedazOkres,
        wzNiepowiazaneOkres: wz,
        dostepne: asNum(l.dostepne) - contribCover,
      };
    }

    if (l.bom?.role === "assembled_parent") {
      const relocated = Math.max(0, asNum(l.bom.relocatedSales));
      const relocatedWz = Math.max(0, asNum(l.bom.relocatedWz));
      const fromRow = Math.max(0, asNum(l.sprzedazOkres));
      const sprzedazOkres = fromRow > 0 ? fromRow : relocated;
      const wzRaw =
        Math.max(0, asNum(l.wzNiepowiazaneOkres)) > 0
          ? Math.max(0, asNum(l.wzNiepowiazaneOkres))
          : relocatedWz;
      return {
        ...l,
        pair: null,
        bom: null,
        sprzedazOkres,
        wzNiepowiazaneOkres: Math.min(wzRaw, sprzedazOkres),
      };
    }

    if (l.bom?.role === "purchased_kit" && l.bom.kitOwnSales != null) {
      const ownSales = Math.max(0, asNum(l.bom.kitOwnSales));
      const ownWz = Math.max(0, asNum(l.bom.kitOwnWz));
      return {
        ...l,
        pair: null,
        bom: null,
        sprzedazOkres: ownSales,
        wzNiepowiazaneOkres: Math.min(ownWz, ownSales),
      };
    }

    return {
      ...l,
      pair: null,
      bom: null,
    };
  });
}
