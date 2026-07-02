import type { TeethKind, TeethJaw, TeethProductLine } from "@/lib/teeth/teeth-catalog-types";
import { toothMouldsForLine } from "@/lib/teeth/teeth-lines-data";
import {
  inferMajorSuperLuxShapeId,
  majorSuperLuxMouldShapeGroups,
} from "@/lib/teeth/major-super-lux-mould-shapes";
import {
  dentexAmberluxMouldShapeGroups,
  inferDentexAmberluxShapeId,
} from "@/lib/teeth/dentex-amberlux-mould-shapes";
import {
  inferWiedentAlmamissShapeId,
  wiedentAlmamissMouldShapeGroups,
} from "@/lib/teeth/wiedent-almamiss-mould-shapes";
import {
  inferWiedentClassicShapeId,
  wiedentClassicMouldShapeGroups,
} from "@/lib/teeth/wiedent-classic-mould-shapes";
import {
  inferWiedentEsteticShapeId,
  wiedentEsteticMouldShapeGroups,
} from "@/lib/teeth/wiedent-estetic-mould-shapes";
import {
  inferIvoclarOrthotypDclShapeId,
  ivoclarOrthotypDclMouldShapeGroups,
} from "./ivoclar-orthotyp-dcl-mould-shapes";
import {
  inferIvoclarVivodentDclShapeId,
  ivoclarVivodentDclMouldShapeGroups,
} from "./ivoclar-vivodent-dcl-mould-shapes";
import {
  inferIvoclarPhonaresIiShapeId,
  ivoclarPhonaresIiMouldShapeGroups,
} from "./ivoclar-phonares-ii-mould-shapes";
export type TeethMouldShapeId = "oval" | "triangular" | "square" | "lower" | "upper" | "all";

export type TeethMouldShapeGroup = {
  shapeId: TeethMouldShapeId;
  label: string;
  /** Krótka wskazówka producenta (np. Soft / S*). */
  hint?: string;
  moulds: readonly string[];
};

export type TeethJawMode = "upper" | "lower" | "both";

const SHAPE_LABELS: Record<Exclude<TeethMouldShapeId, "all">, string> = {
  oval: "Owalne",
  triangular: "Trójkątne",
  square: "Kwadratowe",
  upper: "Górne",
  lower: "Dolne",
};

function groupByShape(
  moulds: readonly string[],
  classify: (mould: string) => TeethMouldShapeId,
): TeethMouldShapeGroup[] {
  const buckets: Record<Exclude<TeethMouldShapeId, "all">, string[]> = {
    oval: [],
    triangular: [],
    square: [],
    upper: [],
    lower: [],
  };
  for (const mould of moulds) {
    const shape = classify(mould);
    if (shape === "all") {
      buckets.oval.push(mould);
      continue;
    }
    buckets[shape].push(mould);
  }
  const order: Exclude<TeethMouldShapeId, "all">[] = ["oval", "triangular", "square"];
  return order
    .filter((shapeId) => buckets[shapeId].length > 0)
    .map((shapeId) => ({
      shapeId,
      label: SHAPE_LABELS[shapeId],
      moulds: buckets[shapeId],
    }));
}

function majorCompositeAnteriorShape(mould: string): TeethMouldShapeId {
  const c = mould.trim().charAt(0).toUpperCase();
  if (c === "L") return "triangular";
  if (c === "S" || c === "B") return "square";
  if (c === "M") return "oval";
  return "all";
}

function schottlanderAnteriorShape(mould: string): TeethMouldShapeId {
  const m = mould.trim().toUpperCase();
  if (m.startsWith("IR") || m.startsWith("IS") || m.startsWith("IT")) return "triangular";
  if (m.startsWith("S")) return "square";
  if (m.startsWith("L") || m.startsWith("K") || m.startsWith("D")) return "oval";
  return "all";
}

function classifyMouldShape(
  mould: string,
  productLine: TeethProductLine,
  kind: TeethKind,
): TeethMouldShapeId {
  if (productLine === "ivoclar_phonares_ii" && kind === "anterior") {
    return inferIvoclarPhonaresIiShapeId(mould);
  }
  if (productLine === "major_composite" && kind === "anterior") {
    return majorCompositeAnteriorShape(mould);
  }
  if (productLine === "schottlander_enigmalife" && kind === "anterior") {
    return schottlanderAnteriorShape(mould);
  }
  return "all";
}

export function mouldShapeGroupsFor(
  productLine: TeethProductLine,
  kind: TeethKind,
): TeethMouldShapeGroup[] {
  if (productLine === "ivoclar_phonares_ii") {
    return ivoclarPhonaresIiMouldShapeGroups(kind);
  }
  if (productLine === "ivoclar_vivodent_dcl") {
    return ivoclarVivodentDclMouldShapeGroups(kind);
  }
  if (productLine === "ivoclar_orthotyp_dcl") {
    return ivoclarOrthotypDclMouldShapeGroups(kind);
  }
  if (productLine === "wiedent_estetic" || productLine === "wiedent_estetic_vita") {
    return wiedentEsteticMouldShapeGroups(kind);
  }
  if (productLine === "wiedent_classic") {
    return wiedentClassicMouldShapeGroups(kind);
  }
  if (productLine === "wiedent_almamiss") {
    return wiedentAlmamissMouldShapeGroups(kind);
  }
  if (productLine === "dentex_amberlux" || productLine === "dentex_amberlux_v") {
    return dentexAmberluxMouldShapeGroups(kind);
  }
  if (productLine === "major_super_lux") {
    return majorSuperLuxMouldShapeGroups(kind);
  }

  const moulds = toothMouldsForLine(productLine, kind);  if (!moulds.length) return [];

  const grouped = groupByShape(moulds, (m) => classifyMouldShape(m, productLine, kind));

  if (grouped.length <= 1) {
    return [
      {
        shapeId: "all",
        label: "Wszystkie fasony",
        moulds,
      },
    ];
  }

  return grouped;
}

export function inferShapeIdForMould(
  mould: string | null | undefined,
  productLine: TeethProductLine,
  kind: TeethKind,
): TeethMouldShapeId {
  const trimmed = mould?.trim();
  if (!trimmed) return "all";
  if (productLine === "ivoclar_phonares_ii") {
    return inferIvoclarPhonaresIiShapeId(trimmed);
  }
  if (productLine === "ivoclar_vivodent_dcl") {
    return inferIvoclarVivodentDclShapeId(trimmed);
  }
  if (productLine === "ivoclar_orthotyp_dcl") {
    return inferIvoclarOrthotypDclShapeId(trimmed);
  }
  if (productLine === "wiedent_estetic" && kind === "anterior") {
    return inferWiedentEsteticShapeId(trimmed);
  }
  if (productLine === "wiedent_estetic_vita" && kind === "anterior") {
    return inferWiedentEsteticShapeId(trimmed);
  }
  if (productLine === "wiedent_classic" && kind === "anterior") {
    return inferWiedentClassicShapeId(trimmed);
  }
  if (productLine === "wiedent_almamiss" && kind === "anterior") {
    return inferWiedentAlmamissShapeId(trimmed);
  }
  if ((productLine === "dentex_amberlux" || productLine === "dentex_amberlux_v") && kind === "anterior") {
    return inferDentexAmberluxShapeId(trimmed);
  }
  if (productLine === "major_super_lux" && kind === "anterior") {
    return inferMajorSuperLuxShapeId(trimmed);
  }
  const shape = classifyMouldShape(trimmed, productLine, kind);  if (shape !== "all") return shape;
  const groups = mouldShapeGroupsFor(productLine, kind);
  const match = groups.find((g) => g.moulds.includes(trimmed));
  return match?.shapeId ?? "all";
}

/** Para fasonów góra/dół dla boków Ivoclar (NU/NL, LU/LL, N*U/N*L). */
export function resolvePosteriorMouldPair(
  mould: string,
  productLine: TeethProductLine,
): { upper: string; lower: string } | null {
  const m = mould.trim().toUpperCase();

  if (productLine === "ivoclar_phonares_ii") {
    if (m.startsWith("NU") && m.length > 2) {
      return { upper: m, lower: `NL${m.slice(2)}` };
    }
    if (m.startsWith("NL") && m.length > 2) {
      return { upper: `NU${m.slice(2)}`, lower: m };
    }
    if (m.startsWith("LU") && m.length > 2) {
      return { upper: m, lower: `LL${m.slice(2)}` };
    }
    if (m.startsWith("LL") && m.length > 2) {
      return { upper: `LU${m.slice(2)}`, lower: m };
    }
    return null;
  }

  if (productLine === "ivoclar_orthotyp_dcl") {
    if (/^N\dU$/.test(m)) {
      return { upper: m, lower: `${m.slice(0, -1)}L` };
    }
    if (/^N\dL$/.test(m)) {
      return { upper: `${m.slice(0, -1)}U`, lower: m };
    }
    if (/^N\d$/.test(m)) {
      return { upper: `${m}U`, lower: `${m}L` };
    }
    if (m.startsWith("LU") && m.length > 2) {
      return { upper: m, lower: `LL${m.slice(2)}` };
    }
    if (m.startsWith("LL") && m.length > 2) {
      return { upper: `LU${m.slice(2)}`, lower: m };
    }
    return null;
  }

  return null;
}

export function jawRequiredForKind(kind: TeethKind | null | undefined): boolean {
  return kind === "posterior";
}

export function shouldShowJawPicker(kind: TeethKind | null | undefined): boolean {
  return kind === "posterior";
}

/** Linie z kolumnowym pickerem fasonów wg katalogu PDF (stała kolejność sekcji). */
export function catalogUsesFixedMouldColumns(line: TeethProductLine): boolean {
  return (
    line === "wiedent_estetic" ||
    line === "wiedent_estetic_vita" ||
    line === "wiedent_classic" ||
    line === "wiedent_almamiss" ||
    line === "dentex_amberlux" ||
    line === "dentex_amberlux_v" ||
    line === "major_super_lux" ||
    line === "ivoclar_phonares_ii" ||
    line === "ivoclar_vivodent_dcl" ||
    line === "ivoclar_orthotyp_dcl"
  );
}

/** @deprecated Użyj {@link catalogUsesFixedMouldColumns}. */
export function wiedentUsesFixedMouldColumns(line: TeethProductLine): boolean {
  return catalogUsesFixedMouldColumns(line);
}

export function isJawModeSatisfied(
  kind: TeethKind | null | undefined,
  jaw: TeethJaw | null | undefined,
  jawMode: TeethJawMode | null | undefined,
): boolean {
  if (!jawRequiredForKind(kind)) return true;
  if (jawMode === "both" || jawMode === "upper" || jawMode === "lower") return true;
  return jaw === "upper" || jaw === "lower";
}
