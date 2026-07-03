import type { TeethKind } from "@/lib/teeth/teeth-catalog-types";
import type { TeethMouldShapeGroup, TeethMouldShapeId } from "@/lib/teeth/teeth-mould-shape-groups";

/**
 * Podział fasonów wg katalogu Wiedent Estetic (katalog_Estetic.pdf, mould chart).
 * Górne przody: Ovoid / Square / Triangular.
 * Dolne przody: osobna sekcja (kody 00–011) — bez pola szczęki w UI.
 * Boki: jedna paleta (60–80).
 */

/** Górne — owalne (Ovoid upper anterior). */
export const WIEDENT_ESTETIC_UPPER_OVAL = [
  "32", "33", "37", "38", "42", "43", "45", "47", "48", "49",
] as const;

/** Górne — kwadratowe (Square upper anterior). */
export const WIEDENT_ESTETIC_UPPER_SQUARE = [
  "20", "21", "22", "23", "25", "26", "27", "28", "29",
  "34", "35", "36", "39", "46", "50",
] as const;

/** Górne — trójkątne (Triangular upper anterior). */
export const WIEDENT_ESTETIC_UPPER_TRIANGULAR = [
  "12", "13", "14", "15", "17", "18", "31", "40", "41",
] as const;

/** Dolne przody (lower anterior) — bez podziału kształtu w katalogu. */
export const WIEDENT_ESTETIC_LOWER_ANTERIOR = [
  "00", "02", "03", "04", "05", "06", "07", "08", "08x", "09", "010", "011",
] as const;

export const WIEDENT_ESTETIC_POSTERIOR = [
  "60", "62", "65", "70", "72", "74", "76", "77", "79", "80",
] as const;

const WIEDENT_SHAPE_LOOKUP: ReadonlyMap<string, TeethMouldShapeId> = new Map([
  ...WIEDENT_ESTETIC_UPPER_OVAL.map((m) => [m, "oval"] as const),
  ...WIEDENT_ESTETIC_UPPER_SQUARE.map((m) => [m, "square"] as const),
  ...WIEDENT_ESTETIC_UPPER_TRIANGULAR.map((m) => [m, "triangular"] as const),
  ...WIEDENT_ESTETIC_LOWER_ANTERIOR.map((m) => [m, "lower"] as const),
]);

export function wiedentEsteticMouldShapeGroups(kind: TeethKind): TeethMouldShapeGroup[] {
  if (kind === "posterior") {
    return [
      {
        shapeId: "all",
        label: "Wszystkie fasony",
        hint: "Boczne góra / dół",
        moulds: WIEDENT_ESTETIC_POSTERIOR,
      },
    ];
  }

  return [
    {
      shapeId: "triangular",
      label: "Trójkątne",
      hint: "Górne",
      moulds: WIEDENT_ESTETIC_UPPER_TRIANGULAR,
    },
    {
      shapeId: "square",
      label: "Kwadratowe",
      hint: "Górne",
      moulds: WIEDENT_ESTETIC_UPPER_SQUARE,
    },
    {
      shapeId: "oval",
      label: "Owalne",
      hint: "Górne",
      moulds: WIEDENT_ESTETIC_UPPER_OVAL,
    },
    {
      shapeId: "lower",
      label: "Dolne",
      hint: "Szczęka dolna · kody 00–011",
      moulds: WIEDENT_ESTETIC_LOWER_ANTERIOR,
    },
  ];
}

export function inferWiedentEsteticShapeId(mould: string): TeethMouldShapeId {
  return WIEDENT_SHAPE_LOOKUP.get(mould.trim()) ?? "all";
}
