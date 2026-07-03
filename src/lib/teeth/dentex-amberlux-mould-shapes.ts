import type { TeethKind } from "@/lib/teeth/teeth-catalog-types";
import type { TeethMouldShapeGroup, TeethMouldShapeId } from "@/lib/teeth/teeth-mould-shape-groups";

/**
 * Podział fasonów wg katalogu Dentex AmberLux (Katalog_DENTEX_DRUK.pdf, mould chart).
 * Górne przody: owalne (○), trójkątne (△), kwadratowe (□).
 * Dolne przody: osobna sekcja (00–09).
 * Boki: rzymskie I–VIII + X (brak IX w katalogu).
 */

/** Górne — owalne. */
export const DENTEX_AMBERLUX_UPPER_OVAL = [
  "3", "5", "9", "13", "15", "18", "26", "28", "38", "48",
] as const;

/** Górne — trójkątne. */
export const DENTEX_AMBERLUX_UPPER_TRIANGULAR = [
  "0", "6", "7", "8", "10", "11", "12", "14", "16", "17", "41",
] as const;

/** Górne — kwadratowe. */
export const DENTEX_AMBERLUX_UPPER_SQUARE = [
  "1", "2", "4",
] as const;

/** Dolne przody. */
export const DENTEX_AMBERLUX_LOWER_ANTERIOR = [
  "00", "01", "02", "03", "04", "05", "07", "09",
] as const;

/** Boczne — 9 fasonów wg katalogu (bez IX). */
export const DENTEX_AMBERLUX_POSTERIOR = [
  "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "X",
] as const;

const DENTEX_SHAPE_LOOKUP: ReadonlyMap<string, TeethMouldShapeId> = new Map([
  ...DENTEX_AMBERLUX_UPPER_OVAL.map((m) => [m, "oval"] as const),
  ...DENTEX_AMBERLUX_UPPER_TRIANGULAR.map((m) => [m, "triangular"] as const),
  ...DENTEX_AMBERLUX_UPPER_SQUARE.map((m) => [m, "square"] as const),
  ...DENTEX_AMBERLUX_LOWER_ANTERIOR.map((m) => [m, "lower"] as const),
]);

export function dentexAmberluxMouldShapeGroups(kind: TeethKind): TeethMouldShapeGroup[] {
  if (kind === "posterior") {
    return [
      {
        shapeId: "all",
        label: "Wszystkie fasony",
        hint: "Boczne góra / dół",
        moulds: DENTEX_AMBERLUX_POSTERIOR,
      },
    ];
  }

  return [
    {
      shapeId: "triangular",
      label: "Trójkątne",
      hint: "Górne",
      moulds: DENTEX_AMBERLUX_UPPER_TRIANGULAR,
    },
    {
      shapeId: "square",
      label: "Kwadratowe",
      hint: "Górne",
      moulds: DENTEX_AMBERLUX_UPPER_SQUARE,
    },
    {
      shapeId: "oval",
      label: "Owalne",
      hint: "Górne",
      moulds: DENTEX_AMBERLUX_UPPER_OVAL,
    },
    {
      shapeId: "lower",
      label: "Dolne",
      hint: "Szczęka dolna",
      moulds: DENTEX_AMBERLUX_LOWER_ANTERIOR,
    },
  ];
}

export function inferDentexAmberluxShapeId(mould: string): TeethMouldShapeId {
  return DENTEX_SHAPE_LOOKUP.get(mould.trim()) ?? "all";
}
