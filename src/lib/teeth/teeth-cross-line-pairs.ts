import type { TeethProductLine } from "@/lib/teeth/teeth-catalog-types";

/** Pary linii katalogowych: przody i boki to osobne towary w Subiekcie. */
export const TEETH_CROSS_LINE_DUAL_KIND_PAIRS: ReadonlyArray<
  readonly [anteriorLine: TeethProductLine, posteriorLine: TeethProductLine]
> = [
  ["ivoclar_ivostar", "ivoclar_gnathostar"],
  ["ivoclar_vivodent_dcl", "ivoclar_orthotyp_dcl"],
] as const;

export function isCrossLineDualKindPair(
  lineA: TeethProductLine,
  lineB: TeethProductLine,
): boolean {
  return TEETH_CROSS_LINE_DUAL_KIND_PAIRS.some(
    ([anterior, posterior]) =>
      (lineA === anterior && lineB === posterior)
      || (lineA === posterior && lineB === anterior),
  );
}

export function catalogLineForDualKind(
  anchorLine: TeethProductLine,
  kind: "anterior" | "posterior",
): TeethProductLine {
  for (const [anteriorLine, posteriorLine] of TEETH_CROSS_LINE_DUAL_KIND_PAIRS) {
    if (anchorLine === anteriorLine || anchorLine === posteriorLine) {
      return kind === "anterior" ? anteriorLine : posteriorLine;
    }
  }
  return anchorLine;
}
