"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { Button } from "@/components/ui/Button";
import { TeethSpecFields } from "@/components/teeth/TeethSpecFields";
import {
  TeethBuilderEmptyList,
  TeethBuilderFormShell,
  TeethBuilderGroupList,
  TeethBuilderQuantityRow,
  TeethBuilderWorkspace,
  teethBuilderModalSize,
} from "@/components/teeth/TeethOrderBuilderParts";
import {
  draftSpecToGroupInputs,
  isTeethBuilderDraftComplete,
  type TeethBuilderDraftSpec,
} from "@/lib/teeth/teeth-draft-jaw";
import {
  allTeethGroupsComplete,
  createTeethGroupDraft,
  isTeethGroupComplete,
  teethGroupsFromDetails,
  totalTeethCountFromGroups,
  type TeethCatalogRef,
  type TeethGroupDraft,
  type TeethKind,
  type TeethLineDetail,
  type TeethProductLine,
} from "@/lib/teeth/teeth-catalog";
import {
  teethBuilderSteps,
} from "@/lib/teeth/teeth-builder-copy";

type DraftSpec = TeethBuilderDraftSpec;

const emptyDraft = (kind: TeethKind): DraftSpec => ({
  color: "",
  mould: null,
  jaw: null,
  kind,
  count: 1,
  jawMode: null,
});

function draftFromGroup(group: TeethGroupDraft): DraftSpec {
  return {
    color: group.color,
    mould: group.mould,
    jaw: group.jaw,
    kind: group.kind,
    count: group.count,
    jawMode: group.jaw === "upper" ? "upper" : group.jaw === "lower" ? "lower" : null,
  };
}

function pickGroupForInitialEdit(
  groups: TeethGroupDraft[],
  catalog: TeethCatalogRef,
): TeethGroupDraft | null {
  if (groups.length === 0) return null;
  return groups.find((group) => !isTeethGroupComplete(group, catalog)) ?? groups[0];
}

function createSectionState(
  initialDetails: TeethLineDetail[] | undefined,
  lockedKind: TeethKind,
  productLine: TeethProductLine,
) {
  const catalog: TeethCatalogRef = { productLine };
  const groups = teethGroupsFromDetails(initialDetails);
  const editTarget = pickGroupForInitialEdit(groups, catalog);
  return {
    groups,
    draft: editTarget ? draftFromGroup(editTarget) : emptyDraft(lockedKind),
    editingId: editTarget?.id ?? null,
  };
}

export type TeethOrderBuilderSectionHandle = {
  getGroups: () => TeethGroupDraft[];
  setGroups: (groups: TeethGroupDraft[]) => void;
  hasItems: () => boolean;
  isComplete: () => boolean;
  getTotalCount: () => number;
};

export const TeethOrderBuilderSection = forwardRef<
  TeethOrderBuilderSectionHandle,
  {
    productLine: TeethProductLine;
    lockedKind: TeethKind;
    initialDetails?: TeethLineDetail[];
    disabled?: boolean;
    sectionLabel?: string;
    embedded?: boolean;
    /** Mniejsze odstępy w modalu listy zębów (bez wewnętrznego scrolla). */
    dense?: boolean;
    onTotalsChange?: (count: number) => void;
    onStatusChange?: (status: { hasItems: boolean; complete: boolean }) => void;
  }
>(function TeethOrderBuilderSection(
  {
    productLine,
    lockedKind,
    initialDetails,
    disabled,
    sectionLabel,
    embedded = false,
    dense = false,
    onTotalsChange,
    onStatusChange,
  },
  ref,
) {
  const catalog = useMemo<TeethCatalogRef>(() => ({ productLine }), [productLine]);
  const [groups, setGroups] = useState<TeethGroupDraft[]>(
    () => createSectionState(initialDetails, lockedKind, productLine).groups,
  );
  const [draft, setDraft] = useState<DraftSpec>(
    () => createSectionState(initialDetails, lockedKind, productLine).draft,
  );
  const [editingId, setEditingId] = useState<string | null>(
    () => createSectionState(initialDetails, lockedKind, productLine).editingId,
  );

  const totalCount = totalTeethCountFromGroups(groups);
  const listComplete = groups.length > 0 && allTeethGroupsComplete(groups, catalog);
  const draftComplete = isTeethBuilderDraftComplete({ ...draft, kind: lockedKind }, catalog);

  useEffect(() => {
    onTotalsChange?.(totalCount);
  }, [onTotalsChange, totalCount]);

  useEffect(() => {
    onStatusChange?.({ hasItems: groups.length > 0, complete: listComplete });
  }, [onStatusChange, groups.length, listComplete]);

  useImperativeHandle(
    ref,
    () => ({
      getGroups: () => groups,
      setGroups: (next) => {
        setGroups(next);
        setEditingId(null);
        setDraft(emptyDraft(lockedKind));
      },
      hasItems: () => groups.length > 0,
      isComplete: () => listComplete,
      getTotalCount: () => totalCount,
    }),
    [groups, listComplete, totalCount, lockedKind],
  );

  const resetDraft = useCallback(() => {
    setDraft(emptyDraft(lockedKind));
    setEditingId(null);
  }, [lockedKind]);

  const handleAddOrUpdate = () => {
    const fullDraft: DraftSpec = { ...draft, kind: lockedKind };
    if (!isTeethBuilderDraftComplete(fullDraft, catalog)) return;

    if (editingId) {
      const nextGroup = createTeethGroupDraft({ ...fullDraft, id: editingId });
      setGroups((prev) => prev.map((g) => (g.id === editingId ? nextGroup : g)));
      setEditingId(nextGroup.id);
      setDraft(draftFromGroup(nextGroup));
      return;
    }

    const expanded = draftSpecToGroupInputs(fullDraft, productLine);
    setGroups((prev) => [...prev, ...expanded.map((row) => createTeethGroupDraft(row))]);
    resetDraft();
  };

  const handleEdit = (group: TeethGroupDraft) => {
    setEditingId(group.id);
    setDraft(draftFromGroup(group));
  };

  const handleRemove = (id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    if (editingId === id) resetDraft();
  };

  const draftSpec = useMemo(
    () => ({
      color: draft.color,
      mould: draft.mould,
      jaw: draft.jaw,
      kind: lockedKind,
      jawMode: draft.jawMode,
    }),
    [draft, lockedKind],
  );

  const steps = useMemo(
    () =>
      teethBuilderSteps({
        kind: lockedKind,
        color: draft.color,
        mould: draft.mould,
        jawMode: draft.jawMode,
        jaw: draft.jaw,
      }),
    [lockedKind, draft.color, draft.mould, draft.jawMode, draft.jaw],
  );

  const wideLayout = teethBuilderModalSize(productLine, lockedKind) === "xl";

  const formBlock = (
    <TeethBuilderFormShell
      title={editingId ? "Edytuj pozycję" : "Nowa pozycja"}
      headerAction={
        editingId ? (
          <Button type="button" variant="ghost" size="sm" onClick={resetDraft} disabled={disabled}>
            Anuluj edycję
          </Button>
        ) : null
      }
      footer={
        <TeethBuilderQuantityRow
          count={draft.count}
          disabled={disabled}
          draftComplete={draftComplete}
          editingId={editingId}
          jawModeBoth={draft.jawMode === "both"}
          onCountChange={(count) => setDraft((p) => ({ ...p, count }))}
          onAddOrUpdate={handleAddOrUpdate}
        />
      }
    >
      <TeethSpecFields
        productLine={productLine}
        detail={draftSpec}
        lockedKind={lockedKind}
        disabled={disabled}
        compact
        builderMode
        hideKindField
        hidePreview
        onChange={(patch) =>
          setDraft((prev) => ({
            ...prev,
            color: patch.color ?? prev.color,
            mould: patch.mould !== undefined ? patch.mould : prev.mould,
            jaw: patch.jaw !== undefined ? patch.jaw : prev.jaw,
            jawMode: patch.jawMode !== undefined ? patch.jawMode : prev.jawMode,
          }))
        }
      />
    </TeethBuilderFormShell>
  );

  const listBlock =
    groups.length > 0 ? (
      <TeethBuilderGroupList
        groups={groups}
        lockedKind={lockedKind}
        editingId={editingId}
        listComplete={listComplete}
        disabled={disabled}
        dense={dense}
        onEdit={handleEdit}
        onRemove={handleRemove}
      />
    ) : (
      <TeethBuilderEmptyList
        kind={lockedKind}
        productLine={productLine}
        variant={embedded ? "neutral" : "accent"}
        compact={dense}
      />
    );

  const content = (
    <TeethBuilderWorkspace
      wide={wideLayout && !dense}
      steps={steps}
      form={formBlock}
      list={listBlock}
    />
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="space-y-2.5 rounded-lg ring-1 ring-indigo-100/80 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-slate-800">{sectionLabel}</h3>
        <span className="text-[10px] font-medium tabular-nums text-indigo-700">{totalCount} szt.</span>
      </div>
      {content}
    </div>
  );
});
