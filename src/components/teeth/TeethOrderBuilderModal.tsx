"use client";

import { useCallback, useMemo, useState } from "react";
import { ModalShell, type ModalTier } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { TeethSpecFields } from "@/components/teeth/TeethSpecFields";
import {
  allTeethGroupsComplete,
  createTeethGroupDraft,
  expandTeethGroups,
  formatTeethGroupLabel,
  isTeethGroupComplete,
  teethGroupsFromDetails,
  teethManufacturerLabel,
  teethProductLineLabel,
  totalTeethCountFromGroups,
  type TeethCatalogRef,
  type TeethGroupDraft,
  type TeethKind,
  type TeethLineDetail,
  type TeethManufacturer,
  type TeethProductLine,
} from "@/lib/teeth/teeth-catalog";
import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";

type DraftSpec = Pick<TeethGroupDraft, "color" | "mould" | "jaw" | "kind" | "count">;

const EMPTY_DRAFT = (): DraftSpec => ({
  color: "",
  mould: null,
  jaw: null,
  kind: null,
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

function createTeethOrderBuilderState(
  initialDetails: TeethLineDetail[] | undefined,
  defaultKind: TeethKind | null | undefined,
  productLine: TeethProductLine,
) {
  const catalog: TeethCatalogRef = { productLine };
  const groups = teethGroupsFromDetails(initialDetails);
  const editTarget = pickGroupForInitialEdit(groups, catalog);
  return {
    groups,
    draft: editTarget
      ? draftFromGroup(editTarget)
      : { ...EMPTY_DRAFT(), kind: defaultKind ?? null },
    editingId: editTarget?.id ?? null,
  };
}

export function TeethOrderBuilderModal({
  open,
  onClose,
  productLine,
  manufacturer,
  defaultKind,
  productLabel,
  initialDetails,
  onSave,
  disabled,
  tier = "stack",
}: {
  open: boolean;
  onClose: () => void;
  productLine: TeethProductLine;
  manufacturer: TeethManufacturer;
  defaultKind?: TeethKind | null;
  productLabel?: string;
  initialDetails?: TeethLineDetail[];
  onSave: (details: TeethLineDetail[], totalQuantity: number) => void;
  disabled?: boolean;
  /** Nad modalem edycji prośby (raised = z-60). Domyślnie stack. */
  tier?: ModalTier;
}) {
  const catalog = useMemo<TeethCatalogRef>(() => ({ productLine }), [productLine]);
  const [groups, setGroups] = useState<TeethGroupDraft[]>(
    () => createTeethOrderBuilderState(initialDetails, defaultKind, productLine).groups,
  );
  const [draft, setDraft] = useState<DraftSpec>(
    () => createTeethOrderBuilderState(initialDetails, defaultKind, productLine).draft,
  );
  const [editingId, setEditingId] = useState<string | null>(
    () => createTeethOrderBuilderState(initialDetails, defaultKind, productLine).editingId,
  );

  const manufacturerName = teethManufacturerLabel(manufacturer);
  const lineName = teethProductLineLabel(productLine);
  const totalCount = totalTeethCountFromGroups(groups);
  const draftComplete = isTeethGroupComplete(
    { ...draft, kind: defaultKind ?? draft.kind },
    catalog,
  );
  const listComplete = allTeethGroupsComplete(groups, catalog);

  const resetDraft = useCallback(() => {
    setDraft({ ...EMPTY_DRAFT(), kind: defaultKind ?? null });
    setEditingId(null);
  }, [defaultKind]);

  const handleAddOrUpdate = () => {
    const resolvedKind = defaultKind ?? draft.kind;
    const nextGroup = createTeethGroupDraft({
      ...draft,
      kind: resolvedKind,
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

  const handleSave = () => {
    if (!listComplete) return;
    const details = expandTeethGroups(groups);
    onSave(details, totalCount);
    onClose();
  };

  const draftSpec = useMemo(
    () => ({
      color: draft.color,
      mould: draft.mould,
      jaw: draft.jaw,
      kind: defaultKind ?? draft.kind,
    }),
    [draft, defaultKind],
  );

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      size="lg"
      tier={tier}
      title="Lista zębów"
      description={
        productLabel
          ? `${productLabel}${lineName ? ` · ${lineName}` : manufacturerName ? ` · ${manufacturerName}` : ""}`
          : lineName ?? manufacturerName ?? undefined
      }
      titleHint="Dodaj pozycje z kartki klienta (kolor, fason, szczęka i ilość). Łączna liczba sztuk ustawi się automatycznie w zamówieniu."
      footer={
        <>
          <span className="mr-auto self-center text-sm font-medium text-slate-600 tabular-nums">
            Razem: <span className="text-violet-700">{totalCount || 0}</span> szt.
          </span>
          <Button type="button" variant="secondary" onClick={onClose} disabled={disabled}>
            Anuluj
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={disabled || !listComplete}
            onClick={handleSave}
          >
            Zapisz listę
          </Button>
        </>
      }
      bodyClassName="px-5 py-4 sm:px-6"
    >
      <div className="space-y-5">
        {lineName ? (
          <div className="rounded-lg border border-violet-200/80 bg-violet-50/40 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-800/80">
              Katalog dla wybranego towaru
            </p>
            <p className="mt-0.5 text-sm font-medium text-violet-950">{lineName}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-violet-900/70">
              Kolory i fasony pochodzą z linii przypisanej do tego produktu. Aby zamówić inną linię,
              użyj „Zmień towar” i wybierz właściwy artykuł.
            </p>
          </div>
        ) : null}

        {groups.length > 0 ? (
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Twoja lista ({groups.length})
              </h3>
              {!listComplete ? (
                <span className="text-[11px] font-medium text-amber-600">Uzupełnij wszystkie pozycje</span>
              ) : (
                <span className="text-[11px] font-medium text-violet-600">Gotowe do zapisu</span>
              )}
            </div>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
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
                      {formatTeethGroupLabel(g)}
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
          <div className="rounded-lg border border-dashed border-violet-200 bg-violet-50/40 px-4 py-6 text-center">
            <p className="text-sm font-medium text-violet-900">Brak pozycji na liście</p>
            <p className="mt-1 text-xs text-violet-700/90">
              Dodaj pierwszą pozycję poniżej — np. A2 · 56 · góra × 4 szt.
            </p>
          </div>
        )}

        <section className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {editingId ? "Edytuj pozycję" : "Nowa pozycja"}
          </h3>

          <TeethSpecFields
            productLine={productLine}
            detail={draftSpec}
            lockedKind={defaultKind ?? null}
            disabled={disabled}
            compact
            onChange={(patch) =>
              setDraft((prev) => ({
                ...prev,
                color: patch.color ?? prev.color,
                mould: patch.mould !== undefined ? patch.mould : prev.mould,
                jaw: patch.jaw !== undefined ? patch.jaw : prev.jaw,
                kind: patch.kind !== undefined ? patch.kind : prev.kind,
              }))
            }
          />

          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-200/80 pt-4">
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
                    setDraft((p) => ({ ...p, count: Number.isFinite(n) && n >= 1 ? Math.min(99, n) : 1 }));
                  }}
                  className={cn(
                    "w-16 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-center text-sm font-semibold tabular-nums",
                    controlFocusClass,
                  )}
                  aria-label="Ilość sztuk tej pozycji"
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
      </div>
    </ModalShell>
  );
}

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
