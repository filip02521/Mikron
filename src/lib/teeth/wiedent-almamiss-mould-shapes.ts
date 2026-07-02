import type { TeethKind } from "@/lib/teeth/teeth-catalog-types";
import type { TeethMouldShapeGroup, TeethMouldShapeId } from "@/lib/teeth/teeth-mould-shape-groups";

/**
 * Podział fasonów wg katalogu Wiedent Almamiss UE (katalog_Almamiss_ue.pdf, mould chart).
 * Górne i dolne przody — osobne sekcje; boki (650–790) z U/L w katalogu → szczęka w UI.
 */

/** Górne przody (upper anterior). */
export const WIEDENT_ALMAMISS_UPPER_ANTERIOR = [
  "210", "220", "250", "270", "271", "273",
  "320", "322", "330", "350", "351", "352", "353", "354", "355", "356", "357", "358",
  "370", "371", "372", "373",
  "400", "401", "412", "413", "415",
] as const;

/** Dolne przody (lower anterior). */
export const WIEDENT_ALMAMISS_LOWER_ANTERIOR = [
  "104", "106", "108", "110", "111",
] as const;

export const WIEDENT_ALMAMISS_POSTERIOR = [
  "650", "700", "760", "780", "790",
] as const;

const WIEDENT_ALMAMISS_SHAPE_LOOKUP: ReadonlyMap<string, TeethMouldShapeId> = new Map([
  ...WIEDENT_ALMAMISS_UPPER_ANTERIOR.map((m) => [m, "upper"] as const),
  ...WIEDENT_ALMAMISS_LOWER_ANTERIOR.map((m) => [m, "lower"] as const),
]);

export function wiedentAlmamissMouldShapeGroups(kind: TeethKind): TeethMouldShapeGroup[] {
  if (kind === "posterior") {
    return [
      {
        shapeId: "all",
        label: "Wszystkie fasony",
        hint: "Boczne góra / dół",
        moulds: WIEDENT_ALMAMISS_POSTERIOR,
      },
    ];
  }

  return [
    {
      shapeId: "lower",
      label: "Dolne",
      hint: "Szczęka dolna",
      moulds: WIEDENT_ALMAMISS_LOWER_ANTERIOR,
    },
    {
      shapeId: "upper",
      label: "Górne",
      hint: "Szczęka górna",
      moulds: WIEDENT_ALMAMISS_UPPER_ANTERIOR,
    },
  ];
}

export function inferWiedentAlmamissShapeId(mould: string): TeethMouldShapeId {
  return WIEDENT_ALMAMISS_SHAPE_LOOKUP.get(mould.trim()) ?? "all";
}
