import type { TeethGroupDraft, TeethCatalogRef } from "@/lib/teeth/teeth-catalog";
import { isTeethDetailComplete } from "@/lib/teeth/teeth-catalog";
import type { TeethKind, TeethJaw, TeethProductLine } from "@/lib/teeth/teeth-catalog-types";
import type { TeethJawMode } from "@/lib/teeth/teeth-mould-shape-groups";
import { resolvePosteriorMouldPair, isJawModeSatisfied } from "@/lib/teeth/teeth-mould-shape-groups";

export type TeethBuilderDraftSpec = {
  color: string;
  mould: string | null;
  jaw: TeethJaw | null;
  kind: TeethKind | null;
  count: number;
  id?: string;
  jawMode?: TeethJawMode | null;
};

/** Rozwija draft do 1–2 grup przy zapisie (szczęka „Oba” → góra + dół). */
export function expandDraftToJawGroups(
  draft: TeethBuilderDraftSpec,
  productLine: TeethProductLine,
): Omit<TeethBuilderDraftSpec, "jawMode">[] {
  const kind = draft.kind;
  if (!kind) return [];

  if (kind === "anterior") {
    return [
      {
        color: draft.color,
        mould: draft.mould,
        jaw: null,
        kind,
        count: draft.count,
        id: draft.id,
      },
    ];
  }

  const jawMode =
    draft.jawMode ??
    (draft.jaw === "upper" ? "upper" : draft.jaw === "lower" ? "lower" : null);

  if (jawMode === "both") {
    const mould = draft.mould?.trim() ?? "";
    const pair = mould ? resolvePosteriorMouldPair(mould, productLine) : null;
    const base = {
      color: draft.color,
      kind,
      count: draft.count,
    };
    if (pair) {
      return [
        { ...base, mould: pair.upper, jaw: "upper" as const },
        { ...base, mould: pair.lower, jaw: "lower" as const },
      ];
    }
    return [
      { ...base, mould: draft.mould, jaw: "upper" as const },
      { ...base, mould: draft.mould, jaw: "lower" as const },
    ];
  }

  const jaw = jawMode === "upper" || jawMode === "lower" ? jawMode : draft.jaw;
  return [
    {
      color: draft.color,
      mould: draft.mould,
      jaw: jaw ?? null,
      kind,
      count: draft.count,
      id: draft.id,
    },
  ];
}

export function draftSpecToGroupInputs(
  draft: TeethBuilderDraftSpec,
  productLine: TeethProductLine,
): Array<Omit<TeethGroupDraft, "id"> & { id?: string }> {
  return expandDraftToJawGroups(draft, productLine).map((row) => ({
    color: row.color,
    mould: row.mould,
    jaw: row.jaw,
    kind: row.kind!,
    count: row.count,
    id: row.id,
  }));
}

/** Walidacja draftu w builderze (obsługa jawMode „Oba”). */
export function isTeethBuilderDraftComplete(
  draft: TeethBuilderDraftSpec,
  catalog: TeethCatalogRef,
): boolean {
  const kind = draft.kind;
  if (!kind || draft.count < 1) return false;
  if (!isJawModeSatisfied(kind, draft.jaw, draft.jawMode)) return false;

  const jawForCheck =
    kind === "posterior"
      ? draft.jawMode === "both"
        ? ("upper" as const)
        : draft.jawMode === "upper" || draft.jawMode === "lower"
          ? draft.jawMode
          : draft.jaw
      : null;

  return isTeethDetailComplete(
    {
      position: 1,
      color: draft.color,
      mould: draft.mould,
      jaw: jawForCheck,
      kind,
    },
    catalog,
  );
}
