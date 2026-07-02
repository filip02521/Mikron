import type { TeethKind } from "@/lib/teeth/teeth-catalog-types";
import type { TeethMouldShapeGroup, TeethMouldShapeId } from "@/lib/teeth/teeth-mould-shape-groups";

/**
 * Karta fasonów SR Orthotyp / Ortholingual S DCL (Ivoclar, PDF 13267).
 * Boki Orthotyp: N*U / N*L · boki Ortholingual: LU* / LL*.
 */

/** Orthotyp — górna szczęka. */
export const ORTHOTYP_DCL_POSTERIOR_TYP_UPPER = ["N3U", "N4U", "N5U", "N6U"] as const;

/** Orthotyp — dolna szczęka. */
export const ORTHOTYP_DCL_POSTERIOR_TYP_LOWER = ["N3L", "N4L", "N5L", "N6L"] as const;

/** Ortholingual — górna szczęka. */
export const ORTHOTYP_DCL_POSTERIOR_LINGUAL_UPPER = ["LU3", "LU5", "LU6"] as const;

/** Ortholingual — dolna szczęka. */
export const ORTHOTYP_DCL_POSTERIOR_LINGUAL_LOWER = ["LL3", "LL5", "LL6"] as const;

/** Kody bez sufiksu U/L (legacy / skrót w zamówieniach). */
export const ORTHOTYP_DCL_POSTERIOR_LEGACY = ["N3", "N4", "N5", "N6"] as const;

export const ORTHOTYP_DCL_POSTERIOR = [
  ...ORTHOTYP_DCL_POSTERIOR_TYP_UPPER,
  ...ORTHOTYP_DCL_POSTERIOR_TYP_LOWER,
  ...ORTHOTYP_DCL_POSTERIOR_LINGUAL_UPPER,
  ...ORTHOTYP_DCL_POSTERIOR_LINGUAL_LOWER,
  ...ORTHOTYP_DCL_POSTERIOR_LEGACY,
] as const;

const ORTHOTYP_DCL_SHAPE_LOOKUP: ReadonlyMap<string, TeethMouldShapeId> = new Map([
  ...ORTHOTYP_DCL_POSTERIOR_TYP_UPPER.map((m) => [m, "upper"] as const),
  ...ORTHOTYP_DCL_POSTERIOR_TYP_LOWER.map((m) => [m, "lower"] as const),
  ...ORTHOTYP_DCL_POSTERIOR_LINGUAL_UPPER.map((m) => [m, "upper"] as const),
  ...ORTHOTYP_DCL_POSTERIOR_LINGUAL_LOWER.map((m) => [m, "lower"] as const),
  ...ORTHOTYP_DCL_POSTERIOR_LEGACY.map((m) => [m, "upper"] as const),
]);

export function ivoclarOrthotypDclMouldShapeGroups(kind: TeethKind): TeethMouldShapeGroup[] {
  if (kind !== "posterior") return [];

  return [
    {
      shapeId: "upper",
      label: "Orthotyp górna",
      hint: "N*U · klasyczna",
      moulds: ORTHOTYP_DCL_POSTERIOR_TYP_UPPER,
    },
    {
      shapeId: "lower",
      label: "Orthotyp dolna",
      hint: "N*L · klasyczna",
      moulds: ORTHOTYP_DCL_POSTERIOR_TYP_LOWER,
    },
    {
      shapeId: "upper",
      label: "Lingual górna",
      hint: "LU* · lingualna",
      moulds: ORTHOTYP_DCL_POSTERIOR_LINGUAL_UPPER,
    },
    {
      shapeId: "lower",
      label: "Lingual dolna",
      hint: "LL* · lingualna",
      moulds: ORTHOTYP_DCL_POSTERIOR_LINGUAL_LOWER,
    },
  ];
}

export function inferIvoclarOrthotypDclShapeId(mould: string): TeethMouldShapeId {
  const trimmed = mould.trim().toUpperCase();
  return ORTHOTYP_DCL_SHAPE_LOOKUP.get(trimmed)
    ?? ORTHOTYP_DCL_SHAPE_LOOKUP.get(mould.trim())
    ?? "all";
}
