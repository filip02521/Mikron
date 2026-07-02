import type { TeethKind } from "@/lib/teeth/teeth-catalog-types";
import type { TeethMouldShapeGroup, TeethMouldShapeId } from "@/lib/teeth/teeth-mould-shape-groups";

/**
 * Podział fasonów wg katalogu Wiedent Classic (katalog_Classic.pdf, mould chart).
 * Górne i dolne przody — osobne sekcje; boki jedna paleta (kody z U/L w katalogu → szczęka w UI).
 */

/** Górne przody (upper anterior). */
export const WIEDENT_CLASSIC_UPPER_ANTERIOR = [
  "402", "421", "431", "437", "441", "461", "471", "480", "481", "507",
] as const;

/** Dolne przody (lower anterior). */
export const WIEDENT_CLASSIC_LOWER_ANTERIOR = [
  "635", "636", "637", "733",
] as const;

export const WIEDENT_CLASSIC_POSTERIOR = [
  "14", "16", "33", "36", "52", "54", "55", "57",
] as const;

const WIEDENT_CLASSIC_SHAPE_LOOKUP: ReadonlyMap<string, TeethMouldShapeId> = new Map([
  ...WIEDENT_CLASSIC_UPPER_ANTERIOR.map((m) => [m, "upper"] as const),
  ...WIEDENT_CLASSIC_LOWER_ANTERIOR.map((m) => [m, "lower"] as const),
]);

export function wiedentClassicMouldShapeGroups(kind: TeethKind): TeethMouldShapeGroup[] {
  if (kind === "posterior") {
    return [
      {
        shapeId: "all",
        label: "Wszystkie fasony",
        hint: "Boczne góra / dół",
        moulds: WIEDENT_CLASSIC_POSTERIOR,
      },
    ];
  }

  return [
    {
      shapeId: "lower",
      label: "Dolne",
      hint: "Szczęka dolna",
      moulds: WIEDENT_CLASSIC_LOWER_ANTERIOR,
    },
    {
      shapeId: "upper",
      label: "Górne",
      hint: "Szczęka górna",
      moulds: WIEDENT_CLASSIC_UPPER_ANTERIOR,
    },
  ];
}

export function inferWiedentClassicShapeId(mould: string): TeethMouldShapeId {
  return WIEDENT_CLASSIC_SHAPE_LOOKUP.get(mould.trim()) ?? "all";
}
