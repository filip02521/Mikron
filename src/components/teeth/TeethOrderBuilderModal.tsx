"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ModalShell, type ModalTier } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { TeethSpecFields } from "@/components/teeth/TeethSpecFields";
import {
  TeethOrderBuilderSection,
  type TeethOrderBuilderSectionHandle,
} from "@/components/teeth/TeethOrderBuilderSection";
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
import {
  TEETH_DUAL_KIND_LABELS,
  TEETH_DUAL_MODAL_TITLE_HINT,
  type TeethDualSectionStatus,
  teethDualSaveBlockReason,
  teethDualSaveReady,
  teethDualSavePreviewMessage,
} from "@/lib/teeth/teeth-builder-copy";
import { partitionTeethDetailsByKind } from "@/lib/teeth/teeth-dual-kind";
import { cn } from "@/lib/cn";
import { controlFocusClass, panelChoiceChipClass, panelChoiceChipIdleClass, panelChoiceChipSelectedClass } from "@/lib/ui/ontime-theme";

const TEETH_MODAL_SHELL_LAYOUT = {
  bodyScroll: false,
  bodyClassName: "overflow-visible px-5 py-3 sm:px-6",
  className:
    "top-[max(0.75rem,env(safe-area-inset-top))] max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-0.75rem)] -translate-y-0",
} as const;

type DraftSpec = Pick<TeethGroupDraft, "color" | "mould" | "jaw" | "kind" | "count">;

export type TeethOrderBuilderSaveResult =
  | { mode: "single"; details: TeethLineDetail[]; totalQuantity: number }
  | {
      mode: "dual";
      anteriorGroups: TeethGroupDraft[];
      posteriorGroups: TeethGroupDraft[];
    };

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
  dualKindInitialDetails,
  dualKindMode = false,
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
  /** Szczegóły przodów i boków przy trybie dual (np. z pozycji kotwicy i siostrzanej). */
  dualKindInitialDetails?: {
    anterior?: TeethLineDetail[];
    posterior?: TeethLineDetail[];
  };
  dualKindMode?: boolean;
  onSave: (result: TeethOrderBuilderSaveResult) => void | boolean;
  disabled?: boolean;
  tier?: ModalTier;
}) {
  if (dualKindMode) {
    return (
      <TeethDualKindOrderBuilderModal
        open={open}
        onClose={onClose}
        productLine={productLine}
        manufacturer={manufacturer}
        productLabel={productLabel}
        defaultKind={defaultKind}
        dualKindInitialDetails={dualKindInitialDetails}
        onSave={onSave}
        disabled={disabled}
        tier={tier}
      />
    );
  }

  return (
    <TeethSingleKindOrderBuilderModal
      open={open}
      onClose={onClose}
      productLine={productLine}
      manufacturer={manufacturer}
      defaultKind={defaultKind}
      productLabel={productLabel}
      initialDetails={initialDetails}
      onSave={onSave}
      disabled={disabled}
      tier={tier}
    />
  );
}

function sectionStatusFromDetails(
  details: TeethLineDetail[],
  productLine: TeethProductLine,
): TeethDualSectionStatus {
  const catalog: TeethCatalogRef = { productLine };
  const groups = teethGroupsFromDetails(details);
  const hasItems = groups.length > 0;
  return {
    hasItems,
    complete: hasItems && allTeethGroupsComplete(groups, catalog),
  };
}

function TeethDualKindOrderBuilderModal({
  open,
  onClose,
  productLine,
  manufacturer,
  productLabel,
  defaultKind,
  dualKindInitialDetails,
  onSave,
  disabled,
  tier,
}: {
  open: boolean;
  onClose: () => void;
  productLine: TeethProductLine;
  manufacturer: TeethManufacturer;
  productLabel?: string;
  defaultKind?: TeethKind | null;
  dualKindInitialDetails?: {
    anterior?: TeethLineDetail[];
    posterior?: TeethLineDetail[];
  };
  onSave: (result: TeethOrderBuilderSaveResult) => void | boolean;
  disabled?: boolean;
  tier?: ModalTier;
}) {
  const anteriorRef = useRef<TeethOrderBuilderSectionHandle>(null);
  const posteriorRef = useRef<TeethOrderBuilderSectionHandle>(null);
  const [activeKind, setActiveKind] = useState<TeethKind>(
    defaultKind === "posterior" ? "posterior" : "anterior",
  );
  const partitioned = useMemo(() => {
    if (dualKindInitialDetails) {
      return {
        anterior: dualKindInitialDetails.anterior ?? [],
        posterior: dualKindInitialDetails.posterior ?? [],
      };
    }
    return { anterior: [], posterior: [] };
  }, [dualKindInitialDetails]);

  const [anteriorStatus, setAnteriorStatus] = useState<TeethDualSectionStatus>(() =>
    sectionStatusFromDetails(partitioned.anterior, productLine),
  );
  const [posteriorStatus, setPosteriorStatus] = useState<TeethDualSectionStatus>(() =>
    sectionStatusFromDetails(partitioned.posterior, productLine),
  );
  const [anteriorCount, setAnteriorCount] = useState(
    () => totalTeethCountFromGroups(teethGroupsFromDetails(partitioned.anterior)),
  );
  const [posteriorCount, setPosteriorCount] = useState(
    () => totalTeethCountFromGroups(teethGroupsFromDetails(partitioned.posterior)),
  );

  const manufacturerName = teethManufacturerLabel(manufacturer);
  const lineName = teethProductLineLabel(productLine);
  const totalCount = anteriorCount + posteriorCount;
  const canSave = teethDualSaveReady(anteriorStatus, posteriorStatus);
  const saveBlockReason = teethDualSaveBlockReason(anteriorStatus, posteriorStatus);
  const previewMessage = teethDualSavePreviewMessage(anteriorCount, posteriorCount);
  const activeCount = activeKind === "anterior" ? anteriorCount : posteriorCount;

  const validateAndSave = () => {
    if (!canSave) return;
    const anterior = anteriorRef.current;
    const posterior = posteriorRef.current;
    if (!anterior || !posterior) return;

    const shouldClose = onSave({
      mode: "dual",
      anteriorGroups: anterior.getGroups(),
      posteriorGroups: posterior.getGroups(),
    });
    if (shouldClose !== false) onClose();
  };

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
      titleHint={TEETH_DUAL_MODAL_TITLE_HINT}
      {...TEETH_MODAL_SHELL_LAYOUT}
      footer={
        <>
          <div className="mr-auto min-w-0 space-y-0.5 self-center">
            <span className="block text-sm font-medium text-slate-600 tabular-nums">
              {anteriorCount > 0 || posteriorCount > 0 ? (
                <>
                  {TEETH_DUAL_KIND_LABELS.anterior}:{" "}
                  <span className="text-violet-700">{anteriorCount}</span>
                  {" · "}
                  {TEETH_DUAL_KIND_LABELS.posterior}:{" "}
                  <span className="text-violet-700">{posteriorCount}</span>
                  {" · "}
                  razem <span className="text-violet-700">{totalCount}</span> szt.
                </>
              ) : (
                <>
                  Razem: <span className="text-violet-700">0</span> szt.
                </>
              )}
            </span>
            {previewMessage ? (
              <span className="block text-[11px] font-medium text-slate-500">{previewMessage}</span>
            ) : null}
          </div>
          <Button type="button" variant="secondary" onClick={onClose} disabled={disabled}>
            Anuluj
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={disabled || !canSave}
            title={saveBlockReason ?? undefined}
            onClick={validateAndSave}
          >
            Zapisz listę
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <TeethDualKindToggle
          activeKind={activeKind}
          onChange={setActiveKind}
          anteriorCount={anteriorCount}
          posteriorCount={posteriorCount}
          anteriorStatus={anteriorStatus}
          posteriorStatus={posteriorStatus}
          saveBlockReason={canSave ? null : saveBlockReason}
          disabled={disabled}
        />

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">
              {TEETH_DUAL_KIND_LABELS[activeKind]}
            </p>
            <span className="text-xs font-medium tabular-nums text-violet-700">
              {activeCount} szt. na liście
            </span>
          </div>

          <div className={activeKind === "anterior" ? undefined : "hidden"} aria-hidden={activeKind !== "anterior"}>
            <TeethOrderBuilderSection
              ref={anteriorRef}
              productLine={productLine}
              lockedKind="anterior"
              initialDetails={partitioned.anterior}
              disabled={disabled}
              embedded
              dense
              onTotalsChange={setAnteriorCount}
              onStatusChange={setAnteriorStatus}
            />
          </div>
          <div className={activeKind === "posterior" ? undefined : "hidden"} aria-hidden={activeKind !== "posterior"}>
            <TeethOrderBuilderSection
              ref={posteriorRef}
              productLine={productLine}
              lockedKind="posterior"
              initialDetails={partitioned.posterior}
              disabled={disabled}
              embedded
              dense
              onTotalsChange={setPosteriorCount}
              onStatusChange={setPosteriorStatus}
            />
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function TeethDualKindToggle({
  activeKind,
  onChange,
  anteriorCount,
  posteriorCount,
  anteriorStatus,
  posteriorStatus,
  saveBlockReason,
  disabled,
}: {
  activeKind: TeethKind;
  onChange: (kind: TeethKind) => void;
  anteriorCount: number;
  posteriorCount: number;
  anteriorStatus: TeethDualSectionStatus;
  posteriorStatus: TeethDualSectionStatus;
  saveBlockReason?: string | null;
  disabled?: boolean;
}) {
  const kinds: TeethKind[] = ["anterior", "posterior"];
  const counts: Record<TeethKind, number> = {
    anterior: anteriorCount,
    posterior: posteriorCount,
  };
  const statusByKind: Record<TeethKind, TeethDualSectionStatus> = {
    anterior: anteriorStatus,
    posterior: posteriorStatus,
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Typ</p>
        {saveBlockReason ? (
          <p className="text-[11px] font-medium text-amber-700" role="status">
            {saveBlockReason}
          </p>
        ) : anteriorCount > 0 || posteriorCount > 0 ? (
          <p className="text-[11px] font-medium text-violet-600" role="status">
            Gotowe do zapisu
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Typ zębów">
        {kinds.map((kind) => {
          const selected = activeKind === kind;
          const count = counts[kind];
          const needsAttention = statusByKind[kind].hasItems && !statusByKind[kind].complete;
          return (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => onChange(kind)}
              className={cn(
                panelChoiceChipClass,
                "min-w-[7.5rem] px-4 py-2 text-sm font-semibold",
                selected ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass,
                needsAttention && !selected && "ring-1 ring-amber-300/90",
              )}
            >
              {TEETH_DUAL_KIND_LABELS[kind]}
              {count > 0 ? (
                <span className="ml-1.5 text-[11px] font-medium tabular-nums opacity-90">
                  · {count} szt.
                </span>
              ) : null}
              {needsAttention ? (
                <span className="sr-only"> — wymaga uzupełnienia</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TeethSingleKindOrderBuilderModal({
  open,
  onClose,
  productLine,
  manufacturer,
  defaultKind,
  productLabel,
  initialDetails,
  onSave,
  disabled,
  tier,
}: {
  open: boolean;
  onClose: () => void;
  productLine: TeethProductLine;
  manufacturer: TeethManufacturer;
  defaultKind?: TeethKind | null;
  productLabel?: string;
  initialDetails?: TeethLineDetail[];
  onSave: (result: TeethOrderBuilderSaveResult) => void | boolean;
  disabled?: boolean;
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
    const shouldClose = onSave({ mode: "single", details, totalQuantity: totalCount });
    if (shouldClose !== false) onClose();
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
      {...TEETH_MODAL_SHELL_LAYOUT}
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
    >
      <div className="space-y-3">
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
            <ul className="max-h-32 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white">
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
          <div className="rounded-lg border border-dashed border-violet-200 bg-violet-50/40 px-4 py-4 text-center">
            <p className="text-sm font-medium text-violet-900">Brak pozycji na liście</p>
            <p className="mt-1 text-xs text-violet-700/90">
              Dodaj pierwszą pozycję poniżej — np. A2 · 56 · góra × 4 szt.
            </p>
          </div>
        )}

        <section className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
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

          <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-200/80 pt-3">
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

export function buildDualKindInitialDetails(
  anchorDetails: TeethLineDetail[] | undefined,
  siblingDetails: TeethLineDetail[] | undefined,
  anchorKind: TeethKind | null | undefined,
): { anterior: TeethLineDetail[]; posterior: TeethLineDetail[] } {
  const anchorPartition = partitionTeethDetailsByKind(anchorDetails);
  const siblingPartition = partitionTeethDetailsByKind(siblingDetails);
  if (anchorKind === "posterior") {
    return {
      anterior: siblingPartition.anterior,
      posterior: anchorPartition.posterior.length
        ? anchorPartition.posterior
        : siblingPartition.posterior,
    };
  }
  return {
    anterior: anchorPartition.anterior.length
      ? anchorPartition.anterior
      : siblingPartition.anterior,
    posterior: siblingPartition.posterior,
  };
}
