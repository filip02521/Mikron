import type { TeethKind } from "@/lib/teeth/teeth-catalog-types";
import type { TeethMouldShapeGroup, TeethMouldShapeId } from "@/lib/teeth/teeth-mould-shape-groups";

/**
 * Karta fasonów SR Phonares II (Ivoclar, PDF 8010 / mould chart).
 * Przody: 18 górnych (Soft S* / Bold B*) + 6 dolnych lingual (L50–L55).
 * Boki Typ: NU* / NL* · boki Lingual: LU* / LL*.
 */

/** Górne przody — Soft (S*). */
export const PHONARES_II_ANTERIOR_SOFT = [
  "S61", "S62", "S63",
  "S71", "S72", "S73",
  "S81", "S82", "S83",
] as const;

/** Górne przody — Bold (B*). */
export const PHONARES_II_ANTERIOR_BOLD = [
  "B61", "B62", "B63",
  "B71", "B72", "B73",
  "B81", "B82", "B83",
] as const;

/** Dolne przody lingual (L*). */
export const PHONARES_II_ANTERIOR_LOWER = [
  "L50", "L51", "L52", "L53", "L54", "L55",
] as const;

/** Boki SR Phonares II Typ — górna szczęka. */
export const PHONARES_II_POSTERIOR_TYP_UPPER = ["NU3", "NU5", "NU6"] as const;

/** Boki SR Phonares II Typ — dolna szczęka. */
export const PHONARES_II_POSTERIOR_TYP_LOWER = ["NL3", "NL5", "NL6"] as const;

/** Boki SR Phonares II Lingual — górna szczęka. */
export const PHONARES_II_POSTERIOR_LINGUAL_UPPER = ["LU3", "LU5", "LU6"] as const;

/** Boki SR Phonares II Lingual — dolna szczęka. */
export const PHONARES_II_POSTERIOR_LINGUAL_LOWER = ["LL3", "LL5", "LL6"] as const;

export const PHONARES_II_ANTERIOR = [
  ...PHONARES_II_ANTERIOR_SOFT,
  ...PHONARES_II_ANTERIOR_BOLD,
  ...PHONARES_II_ANTERIOR_LOWER,
] as const;

export const PHONARES_II_POSTERIOR = [
  ...PHONARES_II_POSTERIOR_TYP_UPPER,
  ...PHONARES_II_POSTERIOR_TYP_LOWER,
  ...PHONARES_II_POSTERIOR_LINGUAL_UPPER,
  ...PHONARES_II_POSTERIOR_LINGUAL_LOWER,
] as const;

const PHONARES_II_SHAPE_LOOKUP: ReadonlyMap<string, TeethMouldShapeId> = new Map([
  ...PHONARES_II_ANTERIOR_SOFT.map((m) => [m, "oval"] as const),
  ...PHONARES_II_ANTERIOR_BOLD.map((m) => [m, "square"] as const),
  ...PHONARES_II_ANTERIOR_LOWER.map((m) => [m, "lower"] as const),
  ...PHONARES_II_POSTERIOR_TYP_UPPER.map((m) => [m, "upper"] as const),
  ...PHONARES_II_POSTERIOR_TYP_LOWER.map((m) => [m, "lower"] as const),
  ...PHONARES_II_POSTERIOR_LINGUAL_UPPER.map((m) => [m, "upper"] as const),
  ...PHONARES_II_POSTERIOR_LINGUAL_LOWER.map((m) => [m, "lower"] as const),
]);

export function ivoclarPhonaresIiMouldShapeGroups(kind: TeethKind): TeethMouldShapeGroup[] {
  if (kind === "posterior") {
    return [
      {
        shapeId: "upper",
        label: "Typ górna",
        hint: "NU* · klasyczna",
        moulds: PHONARES_II_POSTERIOR_TYP_UPPER,
      },
      {
        shapeId: "lower",
        label: "Typ dolna",
        hint: "NL* · klasyczna",
        moulds: PHONARES_II_POSTERIOR_TYP_LOWER,
      },
      {
        shapeId: "upper",
        label: "Lingual górna",
        hint: "LU* · lingualna",
        moulds: PHONARES_II_POSTERIOR_LINGUAL_UPPER,
      },
      {
        shapeId: "lower",
        label: "Lingual dolna",
        hint: "LL* · lingualna",
        moulds: PHONARES_II_POSTERIOR_LINGUAL_LOWER,
      },
    ];
  }

  return [
    {
      shapeId: "square",
      label: "Bold",
      hint: "B* · górne",
      moulds: PHONARES_II_ANTERIOR_BOLD,
    },
    {
      shapeId: "oval",
      label: "Soft",
      hint: "S* · górne",
      moulds: PHONARES_II_ANTERIOR_SOFT,
    },
    {
      shapeId: "lower",
      label: "Dolne",
      hint: "L* · lingual",
      moulds: PHONARES_II_ANTERIOR_LOWER,
    },
  ];
}

export function inferIvoclarPhonaresIiShapeId(mould: string): TeethMouldShapeId {
  return PHONARES_II_SHAPE_LOOKUP.get(mould.trim()) ?? "all";
}
