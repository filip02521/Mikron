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
  allTeethGroupsComplete,
  createTeethGroupDraft,
  formatTeethGroupLabel,
  isTeethGroupComplete,
  teethGroupsFromDetails,
  totalTeethCountFromGroups,
  type TeethCatalogRef,
  type TeethGroupDraft,
  type TeethKind,
  type TeethLineDetail,
  type TeethProductLine,
} from "@/lib/teeth/teeth-catalog";
import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";

type DraftSpec = Pick<TeethGroupDraft, "color" | "mould" | "jaw" | "kind" | "count">;

const emptyDraft = (kind: TeethKind): DraftSpec => ({
  color: "",
  mould: null,
  jaw: null,
  kind,
  count: 1,
});

function draftFromGroup(group: TeethGroupDraft): DraftSpec {
  return {
    color: group.color,
    mould: group.mould,
    jaw: group.jaw,
    kind: group.kind,
    count: group.count,
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
  { productLine, lockedKind, initialDetails, disabled, sectionLabel, embedded = false, dense = false, onTotalsChange, onStatusChange },
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
  const draftComplete = isTeethGroupComplete({ ...draft, kind: lockedKind }, catalog);

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
      hasItems: () => groups.length > 0,
      isComplete: () => listComplete,
      getTotalCount: () => totalCount,
    }),
    [groups, listComplete, totalCount],
  );

  const resetDraft = useCallback(() => {
    setDraft(emptyDraft(lockedKind));
    setEditingId(null);
  }, [lockedKind]);

  const handleAddOrUpdate = () => {
    const nextGroup = createTeethGroupDraft({
      ...draft,
      kind: lockedKind,
      id: editingId ?? undefined,
    });
    if (!isTeethGroupComplete(nextGroup, catalog)) return;

    setGroups((prev) => {
      if (editingId) {
        return prev.map((g) => (g.id === editingId ? nextGroup : g));
      }
      return [...prev, nextGroup];
    });
    if (editingId) {
      setEditingId(nextGroup.id);
      setDraft(draftFromGroup(nextGroup));
    } else {
      resetDraft();
    }
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
    }),
    [draft, lockedKind],
  );

  const listBlock = (
    <>
      {groups.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Twoja lista ({groups.length})
            </p>
            {!listComplete ? (
              <span className="text-[11px] font-medium text-amber-600">Uzupełnij pozycje</span>
            ) : (
              <span className="text-[11px] font-medium text-violet-600">Gotowe do zapisu</span>
            )}
          </div>
          <ul
            className={cn(
              "divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white",
              dense ? "max-h-32 overflow-y-auto" : "overflow-hidden",
            )}
          >
            {groups.map((g) => (
              <li
                key={g.id}
                className={cn(
                  "flex items-start gap-2 px-3 py-2.5",
                  editingId === g.id && "bg-violet-50/60",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    {formatTeethGroupLabel({ ...g, kind: lockedKind })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    className="text-slate-600"
                    onClick={() => handleEdit(g)}
                  >
                    Edytuj
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    onClick={() => handleRemove(g.id)}
                  >
                    Usuń
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div
          className={cn(
            "rounded-lg border border-dashed border-violet-200 bg-violet-50/40 px-4 text-center",
            dense ? "py-4" : "py-6",
          )}
        >
          <p className="text-sm font-medium text-violet-900">Brak pozycji na liście</p>
          <p className="mt-1 text-xs text-violet-700/90">
            Dodaj pierwszą pozycję poniżej — np. A2 · S61 · góra × 4 szt.
          </p>
        </div>
      )}

      <section
        className={cn(
          "rounded-lg border border-slate-200 bg-slate-50/50",
          dense ? "mt-3 p-3" : embedded ? "mt-4 p-4" : "p-4",
        )}
      >
        <h4
          className={cn(
            "text-xs font-semibold uppercase tracking-wide text-slate-500",
            dense ? "mb-2" : "mb-3",
          )}
        >
          {editingId ? "Edytuj pozycję" : "Nowa pozycja"}
        </h4>

        <TeethSpecFields
          productLine={productLine}
          detail={draftSpec}
          lockedKind={lockedKind}
          disabled={disabled}
          compact
          hideKindField
          onChange={(patch) =>
            setDraft((prev) => ({
              ...prev,
              color: patch.color ?? prev.color,
              mould: patch.mould !== undefined ? patch.mould : prev.mould,
              jaw: patch.jaw !== undefined ? patch.jaw : prev.jaw,
            }))
          }
        />

        <div className={cn("flex flex-wrap items-end gap-3 border-t border-slate-200/80", dense ? "mt-3 pt-3" : "mt-4 pt-4")}>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Ilość (szt.)
            </label>
            <div className="flex items-center gap-1">
              <QuantityStepButton
                label="−"
                disabled={disabled || draft.count <= 1}
                onClick={() => setDraft((p) => ({ ...p, count: Math.max(1, p.count - 1) }))}
              />
              <input
                type="number"
                min={1}
                max={99}
                disabled={disabled}
                value={draft.count}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setDraft((p) => ({
                    ...p,
                    count: Number.isFinite(n) && n >= 1 ? Math.min(99, n) : 1,
                  }));
                }}
                className={cn(
                  "w-16 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-center text-sm font-semibold tabular-nums",
                  controlFocusClass,
                )}
                aria-label={sectionLabel ? `Ilość sztuk — ${sectionLabel}` : "Ilość sztuk"}
              />
              <QuantityStepButton
                label="+"
                disabled={disabled || draft.count >= 99}
                onClick={() => setDraft((p) => ({ ...p, count: Math.min(99, p.count + 1) }))}
              />
            </div>
          </div>

          <div className="flex flex-1 flex-wrap justify-end gap-2">
            {editingId ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetDraft} disabled={disabled}>
                Anuluj edycję
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || !draftComplete}
              onClick={handleAddOrUpdate}
            >
              {editingId ? "Zaktualizuj pozycję" : "Dodaj do listy"}
            </Button>
          </div>
        </div>
      </section>
    </>
  );

  if (embedded) {
    return <div className={cn(dense ? "space-y-3" : "space-y-5")}>{listBlock}</div>;
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{sectionLabel}</h3>
        <span className="text-xs font-medium tabular-nums text-violet-700">{totalCount} szt.</span>
      </div>
      {listBlock}
    </div>
  );
});

function QuantityStepButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-bold text-slate-700",
        "hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40",
      )}
      aria-label={label === "+" ? "Zwiększ ilość" : "Zmniejsz ilość"}
    >
      {label}
    </button>
  );
}
