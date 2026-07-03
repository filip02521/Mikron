import type { TeethKind } from "@/lib/teeth/teeth-catalog-types";
import type { TeethMouldShapeGroup, TeethMouldShapeId } from "@/lib/teeth/teeth-mould-shape-groups";

/**
 * Podział fasonów wg karty Major Super Lux (Karta-fasonów-Super-Lux.pdf).
 * Przody dolne: prefiks 0/ (bez pola szczęki w UI).
 * Przody górne: trójkątne / owalne / kwadratowe (ikony w katalogu).
 * Boki: L-cusp (1/60–1/74) wg kształtu + N-cusp (70N–79N).
 */

/** Dolne przody. */
export const MAJOR_SUPER_LUX_LOWER_ANTERIOR = [
  "0/3", "0/4", "0/0", "0/5", "0/6", "0/53", "0/8", "0/10", "0/11",
] as const;

/** Górne — trójkątne. */
export const MAJOR_SUPER_LUX_UPPER_TRIANGULAR = [
  "50", "1/44", "1/13", "1/47", "1/17", "1/40", "1/49",
] as const;

/** Górne — owalne. */
export const MAJOR_SUPER_LUX_UPPER_OVAL = [
  "1/30", "56", "58", "52", "1/48", "1/37", "59",
] as const;

/** Górne — kwadratowe. */
export const MAJOR_SUPER_LUX_UPPER_SQUARE = [
  "1/20", "1/32", "1/35", "1/22", "1/25", "53", "1/27", "62",
] as const;

/** Boki L-cusp — trójkątne. */
export const MAJOR_SUPER_LUX_POSTERIOR_L_TRIANGULAR = ["1/60"] as const;

/** Boki L-cusp — owalne. */
export const MAJOR_SUPER_LUX_POSTERIOR_L_OVAL = ["1/74"] as const;

/** Boki L-cusp — kwadratowe. */
export const MAJOR_SUPER_LUX_POSTERIOR_L_SQUARE = ["1/72", "1/65"] as const;

/** Boki N-cusp — półanatomiczne. */
export const MAJOR_SUPER_LUX_POSTERIOR_N = ["70N", "76N", "77N", "79N"] as const;

export const MAJOR_SUPER_LUX_POSTERIOR = [
  ...MAJOR_SUPER_LUX_POSTERIOR_L_TRIANGULAR,
  ...MAJOR_SUPER_LUX_POSTERIOR_L_OVAL,
  ...MAJOR_SUPER_LUX_POSTERIOR_L_SQUARE,
  ...MAJOR_SUPER_LUX_POSTERIOR_N,
] as const;

const MAJOR_SUPER_LUX_SHAPE_LOOKUP: ReadonlyMap<string, TeethMouldShapeId> = new Map([
  ...MAJOR_SUPER_LUX_LOWER_ANTERIOR.map((m) => [m, "lower"] as const),
  ...MAJOR_SUPER_LUX_UPPER_TRIANGULAR.map((m) => [m, "triangular"] as const),
  ...MAJOR_SUPER_LUX_UPPER_OVAL.map((m) => [m, "oval"] as const),
  ...MAJOR_SUPER_LUX_UPPER_SQUARE.map((m) => [m, "square"] as const),
  ...MAJOR_SUPER_LUX_POSTERIOR_L_TRIANGULAR.map((m) => [m, "triangular"] as const),
  ...MAJOR_SUPER_LUX_POSTERIOR_L_OVAL.map((m) => [m, "oval"] as const),
  ...MAJOR_SUPER_LUX_POSTERIOR_L_SQUARE.map((m) => [m, "square"] as const),
]);

export function majorSuperLuxMouldShapeGroups(kind: TeethKind): TeethMouldShapeGroup[] {
  if (kind === "posterior") {
    return [
      {
        shapeId: "triangular",
        label: "L-cusp",
        hint: "Trójkątne",
        moulds: MAJOR_SUPER_LUX_POSTERIOR_L_TRIANGULAR,
      },
      {
        shapeId: "oval",
        label: "L-cusp",
        hint: "Owalne",
        moulds: MAJOR_SUPER_LUX_POSTERIOR_L_OVAL,
      },
      {
        shapeId: "square",
        label: "L-cusp",
        hint: "Kwadratowe",
        moulds: MAJOR_SUPER_LUX_POSTERIOR_L_SQUARE,
      },
      {
        shapeId: "all",
        label: "N-cusp",
        hint: "Półanatomiczne",
        moulds: MAJOR_SUPER_LUX_POSTERIOR_N,
      },
    ];
  }

  return [
    {
      shapeId: "triangular",
      label: "Trójkątne",
      hint: "Górne",
      moulds: MAJOR_SUPER_LUX_UPPER_TRIANGULAR,
    },
    {
      shapeId: "square",
      label: "Kwadratowe",
      hint: "Górne",
      moulds: MAJOR_SUPER_LUX_UPPER_SQUARE,
    },
    {
      shapeId: "oval",
      label: "Owalne",
      hint: "Górne",
      moulds: MAJOR_SUPER_LUX_UPPER_OVAL,
    },
    {
      shapeId: "lower",
      label: "Dolne",
      hint: "Szczęka dolna · 0/*",
      moulds: MAJOR_SUPER_LUX_LOWER_ANTERIOR,
    },
  ];
}

export function inferMajorSuperLuxShapeId(mould: string): TeethMouldShapeId {
  return MAJOR_SUPER_LUX_SHAPE_LOOKUP.get(mould.trim()) ?? "all";
}
