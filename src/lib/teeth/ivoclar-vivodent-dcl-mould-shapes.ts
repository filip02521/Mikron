import type { TeethKind } from "@/lib/teeth/teeth-catalog-types";
import type { TeethMouldShapeGroup, TeethMouldShapeId } from "@/lib/teeth/teeth-mould-shape-groups";

/**
 * Karta fasonów SR Vivodent S DCL (Ivoclar, PDF 13267).
 * Przody: trójkątne / owalne / kwadratowe (górne) + dolne A3–A10.
 */

/** Górne — trójkątne (A1*). */
export const VIVODENT_DCL_UPPER_TRIANGULAR = [
  "A11", "A12", "A13", "A14", "A15", "A17",
] as const;

/** Górne — owalne (A2* + A32, A36). */
export const VIVODENT_DCL_UPPER_OVAL = [
  "A22", "A24", "A24B", "A25", "A26", "A27", "A32", "A36",
] as const;

/** Górne — kwadratowe (A4*, A5*, A6*). */
export const VIVODENT_DCL_UPPER_SQUARE = [
  "A41", "A42", "A44", "A54", "A56", "A66", "A68",
] as const;

/** Dolne przody. */
export const VIVODENT_DCL_LOWER_ANTERIOR = [
  "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10",
] as const;

export const VIVODENT_DCL_ANTERIOR = [
  ...VIVODENT_DCL_UPPER_TRIANGULAR,
  ...VIVODENT_DCL_UPPER_OVAL,
  ...VIVODENT_DCL_UPPER_SQUARE,
  ...VIVODENT_DCL_LOWER_ANTERIOR,
] as const;

const VIVODENT_DCL_SHAPE_LOOKUP: ReadonlyMap<string, TeethMouldShapeId> = new Map([
  ...VIVODENT_DCL_UPPER_TRIANGULAR.map((m) => [m, "triangular"] as const),
  ...VIVODENT_DCL_UPPER_OVAL.map((m) => [m, "oval"] as const),
  ...VIVODENT_DCL_UPPER_SQUARE.map((m) => [m, "square"] as const),
  ...VIVODENT_DCL_LOWER_ANTERIOR.map((m) => [m, "lower"] as const),
]);

export function ivoclarVivodentDclMouldShapeGroups(kind: TeethKind): TeethMouldShapeGroup[] {
  if (kind !== "anterior") return [];

  return [
    {
      shapeId: "triangular",
      label: "Trójkątne",
      hint: "Górne · A1*",
      moulds: VIVODENT_DCL_UPPER_TRIANGULAR,
    },
    {
      shapeId: "oval",
      label: "Owalne",
      hint: "Górne · A2*",
      moulds: VIVODENT_DCL_UPPER_OVAL,
    },
    {
      shapeId: "square",
      label: "Kwadratowe",
      hint: "Górne · A4–A6*",
      moulds: VIVODENT_DCL_UPPER_SQUARE,
    },
    {
      shapeId: "lower",
      label: "Dolne",
      hint: "A3–A10",
      moulds: VIVODENT_DCL_LOWER_ANTERIOR,
    },
  ];
}

export function inferIvoclarVivodentDclShapeId(mould: string): TeethMouldShapeId {
  return VIVODENT_DCL_SHAPE_LOOKUP.get(mould.trim()) ?? "all";
}
