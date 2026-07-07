import {
  teethColorsForLine,
  toothMouldsForLine,
  lineOptionalMould,
  hasMouldsForLineKind,
} from "./teeth-lines-data";
import { jawRequiredForKind } from "./teeth-mould-shape-groups";
import type { TeethProductLine, TeethKind, TeethJaw } from "./teeth-catalog-types";

export type InlineSpecPatch = {
  color?: string;
  mould?: string | null;
  jaw?: string | null;
  kind?: string;
};

export type InlineValidation = { ok: boolean; error?: string };

export function validateInlineSpec(
  patch: InlineSpecPatch,
  productLine: TeethProductLine,
): InlineValidation {
  if (patch.kind !== undefined) {
    if (patch.kind !== "anterior" && patch.kind !== "posterior") {
      return { ok: false, error: "Typ musi być przednie lub boczne" };
    }
  }

  const kind = (patch.kind ?? "posterior") as TeethKind;

  if (patch.color !== undefined) {
    if (!teethColorsForLine(productLine).includes(patch.color)) {
      return { ok: false, error: `Kolor "${patch.color}" nie istnieje w katalogu` };
    }
  }

  if (patch.mould !== undefined) {
    if (patch.mould != null && patch.mould !== "") {
      if (!toothMouldsForLine(productLine, kind).includes(patch.mould)) {
        return { ok: false, error: `Fason "${patch.mould}" nie istnieje dla typu ${kind}` };
      }
    } else if (!lineOptionalMould(productLine) && hasMouldsForLineKind(productLine, kind)) {
      return { ok: false, error: "Fason jest wymagany dla tego typu" };
    }
  }

  if (patch.jaw !== undefined) {
    if (jawRequiredForKind(kind)) {
      if (patch.jaw !== "upper" && patch.jaw !== "lower") {
        return { ok: false, error: "Szczęka (góra/dół) jest wymagana dla zębów bocznych" };
      }
    }
  }

  return { ok: true };
}

export function colorOptions(productLine: TeethProductLine): string[] {
  return [...teethColorsForLine(productLine)];
}

export function mouldOptions(productLine: TeethProductLine, kind: TeethKind): (string | null)[] {
  const moulds = toothMouldsForLine(productLine, kind);
  if (lineOptionalMould(productLine) || moulds.length === 0) {
    return [null, ...moulds];
  }
  return [...moulds];
}

export function jawOptions(kind: TeethKind | null): { value: string | null; label: string }[] {
  if (!kind || !jawRequiredForKind(kind)) {
    return [{ value: null, label: "—" }];
  }
  return [
    { value: "upper", label: "Góra" },
    { value: "lower", label: "Dół" },
  ];
}

export function kindOptions(): { value: TeethKind; label: string }[] {
  return [
    { value: "anterior", label: "Przednie" },
    { value: "posterior", label: "Boczne" },
  ];
}

export function validateCount(value: number): InlineValidation {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return { ok: false, error: "Ilość musi być liczbą całkowitą" };
  }
  if (value < 1) {
    return { ok: false, error: "Ilość musi być co najmniej 1" };
  }
  if (value > 200) {
    return { ok: false, error: "Maksymalna ilość to 200" };
  }
  return { ok: true };
}

export type SpecGroup = {
  color: string;
  mould: string | null;
  jaw: TeethJaw | null;
  kind: TeethKind | null;
  count: number;
  hasOrdered: boolean;
};

export function buildSpecGroups(
  details: { color: string; mould: string | null; jaw: TeethJaw | null; kind: TeethKind | null; ordered_at?: string | null }[],
): SpecGroup[] {
  const map = new Map<string, SpecGroup>();
  for (const d of details) {
    const key = `${d.color}|${d.mould ?? ""}|${d.jaw ?? ""}|${d.kind ?? ""}`;
    let g = map.get(key);
    if (!g) {
      g = {
        color: d.color,
        mould: d.mould,
        jaw: d.jaw,
        kind: d.kind,
        count: 0,
        hasOrdered: false,
      };
      map.set(key, g);
    }
    g.count++;
    if (d.ordered_at != null) g.hasOrdered = true;
  }
  return Array.from(map.values());
}
