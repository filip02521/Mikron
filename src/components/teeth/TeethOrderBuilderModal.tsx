"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ModalShell, type ModalTier } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { TeethSpecFields } from "@/components/teeth/TeethSpecFields";
import {
  draftSpecToGroupInputs,
  isTeethBuilderDraftComplete,
  type TeethBuilderDraftSpec,
} from "@/lib/teeth/teeth-draft-jaw";
import {
  TeethOrderBuilderSection,
  type TeethOrderBuilderSectionHandle,
} from "@/components/teeth/TeethOrderBuilderSection";
import {
  allTeethGroupsComplete,
  createTeethGroupDraft,
  expandTeethGroups,
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
  teethSingleModalTitleHint,
  type TeethDualSectionStatus,
  teethBuilderSteps,
  teethDualSaveBlockReason,
  teethDualSaveReady,
  teethDualSavePreviewMessage,
} from "@/lib/teeth/teeth-builder-copy";
import {
  TeethBuilderEmptyList,
  TeethBuilderFormShell,
  TeethBuilderGroupList,
  TeethBuilderQuantityRow,
  TeethBuilderWorkspace,
  teethBuilderModalSize,
  teethBuilderAlertClass,
} from "@/components/teeth/TeethOrderBuilderParts";
import { IconAlertCircle, IconCircleCheck } from "@/components/icons/StrokeIcons";
import { partitionTeethDetailsByKind, catalogLineForDualKind } from "@/lib/teeth/teeth-dual-kind";
import { TeethOcrWizard } from "@/components/teeth/TeethOcrWizard";
import { IconCamera } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { panelChoiceChipClass, panelChoiceChipIdleClass, panelChoiceChipSelectedClass } from "@/lib/ui/ontime-theme";

const TEETH_MODAL_SHELL_LAYOUT = {
  bodyScroll: false,
  bodyClassName: "overflow-visible px-3 py-3 sm:px-5",
  className:
    "top-[max(0.5rem,env(safe-area-inset-top))] max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-0.75rem)] -translate-y-0",
} as const;

type DraftSpec = TeethBuilderDraftSpec;

export type TeethOrderBuilderSaveResult =
  | { mode: "single"; details: TeethLineDetail[]; totalQuantity: number; fromOcr?: boolean; ocrImagePath?: string | null }
  | {
      mode: "dual";
      anteriorGroups: TeethGroupDraft[];
      posteriorGroups: TeethGroupDraft[];
      fromOcr?: boolean;
      ocrImagePath?: string | null;
    };

const EMPTY_DRAFT = (): DraftSpec => ({
  color: "",
  mould: null,
  jaw: null,
  kind: null,
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

function createTeethOrderBuilderState(
  initialDetails: TeethLineDetail[] | undefined,
  defaultKind: TeethKind | null | undefined,
) {
  const groups = teethGroupsFromDetails(initialDetails);
  return {
    groups,
    draft: { ...EMPTY_DRAFT(), kind: defaultKind ?? null },
    editingId: null,
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
  initialFromOcr,
  initialOcrImagePath,
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
  /** Czy lista została pierwotnie wczytana z OCR — zachowaj przy edycji bez ponownego uploadu. */
  initialFromOcr?: boolean;
  /** Ścieżka zdjęcia OCR zapisana wcześniej — zachowaj przy edycji bez ponownego uploadu. */
  initialOcrImagePath?: string | null;
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
        initialFromOcr={initialFromOcr}
        initialOcrImagePath={initialOcrImagePath}
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
      initialFromOcr={initialFromOcr}
      initialOcrImagePath={initialOcrImagePath}
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
  initialFromOcr,
  initialOcrImagePath,
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
  initialFromOcr?: boolean;
  initialOcrImagePath?: string | null;
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

  const anteriorCatalogLine = useMemo(
    () => catalogLineForDualKind(productLine, "anterior"),
    [productLine],
  );
  const posteriorCatalogLine = useMemo(
    () => catalogLineForDualKind(productLine, "posterior"),
    [productLine],
  );

  const [anteriorStatus, setAnteriorStatus] = useState<TeethDualSectionStatus>(() =>
    sectionStatusFromDetails(partitioned.anterior, anteriorCatalogLine),
  );
  const [posteriorStatus, setPosteriorStatus] = useState<TeethDualSectionStatus>(() =>
    sectionStatusFromDetails(partitioned.posterior, posteriorCatalogLine),
  );
  const [anteriorCount, setAnteriorCount] = useState(
    () => totalTeethCountFromGroups(teethGroupsFromDetails(partitioned.anterior)),
  );
  const [posteriorCount, setPosteriorCount] = useState(
    () => totalTeethCountFromGroups(teethGroupsFromDetails(partitioned.posterior)),
  );
  const [dualFromOcr, setDualFromOcr] = useState(initialFromOcr ?? false);
  const [dualOcrImagePath, setDualOcrImagePath] = useState<string | null>(initialOcrImagePath ?? null);
  const [dualOcrWizardOpen, setDualOcrWizardOpen] = useState(false);

  const manufacturerName = teethManufacturerLabel(manufacturer);
  const lineName = teethProductLineLabel(productLine);
  const totalCount = anteriorCount + posteriorCount;
  const canSave = teethDualSaveReady(anteriorStatus, posteriorStatus);
  const saveBlockReason = teethDualSaveBlockReason(anteriorStatus, posteriorStatus);
  const previewMessage = teethDualSavePreviewMessage(anteriorCount, posteriorCount);
  const activeCount = activeKind === "anterior" ? anteriorCount : posteriorCount;
  const activeCatalogLine = activeKind === "anterior" ? anteriorCatalogLine : posteriorCatalogLine;
  const modalSize = teethBuilderModalSize(activeCatalogLine, activeKind);

  const validateAndSave = () => {
    if (!canSave) return;
    const anterior = anteriorRef.current;
    const posterior = posteriorRef.current;
    if (!anterior || !posterior) return;

    const shouldClose = onSave({
      mode: "dual",
      anteriorGroups: anterior.getGroups(),
      posteriorGroups: posterior.getGroups(),
      fromOcr: dualFromOcr,
      ocrImagePath: dualOcrImagePath,
    });
    if (shouldClose !== false) onClose();
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      size={modalSize}
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
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => setDualOcrWizardOpen(true)}
            >
              <IconCamera size={16} />
              Ze zdjęcia
            </Button>
            <span className="group relative inline-flex">
              <span
                className="cursor-help rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-400 transition-colors group-hover:bg-indigo-100"
                aria-label="Funkcja testowa — sczytywanie zębów ze zdjęcia za pomocą AI"
              >
                Beta
              </span>
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-0 z-20 mb-1.5 hidden w-max max-w-[min(100vw,18rem)] rounded-md border border-indigo-200/90 bg-indigo-50/95 px-2.5 py-1.5 text-[11px] font-medium leading-relaxed text-indigo-900 shadow-md group-hover:block group-focus-within:block"
              >
                To funkcja testowa — sczytywanie listy zębów ze zdjęcia za pomocą AI. Może jeszcze nie działać prawidłowo we wszystkich przypadkach. Wynik zawsze sprawdź przed zapisaniem.
              </span>
            </span>
            <TeethOcrWizard
              open={dualOcrWizardOpen}
              onClose={() => setDualOcrWizardOpen(false)}
              disabled={disabled}
              onResult={(ocrGroups, _detectedProductLines, imagePath) => {
                const anterior = ocrGroups.filter((g) => g.kind === "anterior");
                const posterior = ocrGroups.filter((g) => g.kind === "posterior");
                if (anterior.length) anteriorRef.current?.setGroups(anterior);
                if (posterior.length) posteriorRef.current?.setGroups(posterior);
                setDualFromOcr(true);
                setDualOcrImagePath(imagePath);
              }}
            />
            <div className="ml-auto flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 tabular-nums">
              <span>
                {TEETH_DUAL_KIND_LABELS.anterior}: <span className="text-indigo-700">{anteriorCount}</span>
              </span>
              <span className="text-slate-300">·</span>
              <span>
                {TEETH_DUAL_KIND_LABELS.posterior}: <span className="text-indigo-700">{posteriorCount}</span>
              </span>
              <span className="text-slate-300">·</span>
              <span>
                Razem: <span className="text-indigo-700">{totalCount}</span> szt.
              </span>
            </div>
          </div>
          {previewMessage ? (
            <p className="text-[11px] font-medium text-slate-500">{previewMessage}</p>
          ) : null}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
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
          </div>
        </div>
      }
    >
      <div className="space-y-2.5">
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
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-800">
              {TEETH_DUAL_KIND_LABELS[activeKind]}
            </p>
            <span className="text-[10px] font-medium tabular-nums text-indigo-700">
              {activeCount} szt. na liście
            </span>
          </div>

          <div className={activeKind === "anterior" ? undefined : "hidden"} aria-hidden={activeKind !== "anterior"}>
            <TeethOrderBuilderSection
              ref={anteriorRef}
              productLine={anteriorCatalogLine}
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
              productLine={posteriorCatalogLine}
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
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Typ</p>
        {saveBlockReason ? (
          <span className={teethBuilderAlertClass} role="status">
            <IconAlertCircle size={12} />
            {saveBlockReason}
          </span>
        ) : anteriorCount > 0 || posteriorCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200/80 bg-indigo-50/80 px-2 py-0.5 text-[11px] font-medium text-indigo-700" role="status">
            <IconCircleCheck size={12} />
            Gotowe do zapisu
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Typ zębów">
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
                "min-w-[6.5rem] px-3 py-1.5 text-xs font-semibold",
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
  initialFromOcr,
  initialOcrImagePath,
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
  initialFromOcr?: boolean;
  initialOcrImagePath?: string | null;
  onSave: (result: TeethOrderBuilderSaveResult) => void | boolean;
  disabled?: boolean;
  tier?: ModalTier;
}) {
  const catalog = useMemo<TeethCatalogRef>(() => ({ productLine }), [productLine]);
  const [groups, setGroups] = useState<TeethGroupDraft[]>(
    () => createTeethOrderBuilderState(initialDetails, defaultKind).groups,
  );
  const [draft, setDraft] = useState<DraftSpec>(
    () => createTeethOrderBuilderState(initialDetails, defaultKind).draft,
  );
  const [editingId, setEditingId] = useState<string | null>(
    () => createTeethOrderBuilderState(initialDetails, defaultKind).editingId,
  );
  const [fromOcr, setFromOcr] = useState(initialFromOcr ?? false);
  const [ocrImagePath, setOcrImagePath] = useState<string | null>(initialOcrImagePath ?? null);
  const [ocrWizardOpen, setOcrWizardOpen] = useState(false);

  const manufacturerName = teethManufacturerLabel(manufacturer);
  const lineName = teethProductLineLabel(productLine);
  const totalCount = totalTeethCountFromGroups(groups);
  const kindBreakdown = useMemo(() => {
    let anterior = 0;
    let posterior = 0;
    for (const g of groups) {
      const k = defaultKind ?? g.kind;
      if (k === "anterior") anterior += Math.max(1, g.count);
      else if (k === "posterior") posterior += Math.max(1, g.count);
    }
    return { anterior, posterior };
  }, [groups, defaultKind]);
  const draftComplete = isTeethBuilderDraftComplete(
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
    const fullDraft: DraftSpec = { ...draft, kind: resolvedKind };
    if (!isTeethBuilderDraftComplete(fullDraft, catalog)) return;

    if (editingId) {
      const nextGroup = createTeethGroupDraft({
        color: fullDraft.color,
        mould: fullDraft.mould,
        jaw: fullDraft.jaw,
        kind: fullDraft.kind,
        count: fullDraft.count,
        id: editingId,
      });
      setGroups((prev) => prev.map((g) => (g.id === editingId ? nextGroup : g)));
      resetDraft();
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
    const group = groups.find((g) => g.id === id);
    if (group && !confirm(`Usunąć pozycję ${group.color || "?"} ${group.mould ?? ""} (${group.count} szt.)?`)) return;
    setGroups((prev) => prev.filter((g) => g.id !== id));
    if (editingId === id) resetDraft();
  };

  const handleSave = () => {
    if (!listComplete) return;
    const details = expandTeethGroups(groups);
    const shouldClose = onSave({ mode: "single", details, totalQuantity: totalCount, fromOcr, ocrImagePath });
    if (shouldClose !== false) onClose();
  };

  const resolvedKind = defaultKind ?? draft.kind;
  const draftSpec = useMemo(
    () => ({
      color: draft.color,
      mould: draft.mould,
      jaw: draft.jaw,
      kind: resolvedKind,
      jawMode: draft.jawMode,
    }),
    [draft, resolvedKind],
  );
  const steps = useMemo(
    () =>
      teethBuilderSteps({
        kind: resolvedKind,
        color: draft.color,
        mould: draft.mould,
        jawMode: draft.jawMode,
        jaw: draft.jaw,
        includeKindStep: !defaultKind,
        kindSelected: !!resolvedKind,
      }),
    [resolvedKind, draft.color, draft.mould, draft.jawMode, draft.jaw, defaultKind],
  );
  const modalSize = teethBuilderModalSize(productLine, resolvedKind);
  const wideLayout = modalSize === "xl";
  const saveBlockReason =
    groups.length === 0
      ? "Dodaj co najmniej jedną pozycję na liście"
      : !listComplete
        ? "Uzupełnij wszystkie pozycje na liście"
        : null;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      size={modalSize}
      tier={tier}
      title="Lista zębów"
      description={
        productLabel
          ? `${productLabel}${lineName ? ` · ${lineName}` : manufacturerName ? ` · ${manufacturerName}` : ""}`
          : lineName ?? manufacturerName ?? undefined
      }
      titleHint={teethSingleModalTitleHint(productLine)}
      {...TEETH_MODAL_SHELL_LAYOUT}
      footer={
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => setOcrWizardOpen(true)}
            >
              <IconCamera size={16} />
              Ze zdjęcia
            </Button>
            <span className="group relative inline-flex">
              <span
                className="cursor-help rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-400 transition-colors group-hover:bg-indigo-100"
                aria-label="Funkcja testowa — sczytywanie zębów ze zdjęcia za pomocą AI"
              >
                Beta
              </span>
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-0 z-20 mb-1.5 hidden w-max max-w-[min(100vw,18rem)] rounded-md border border-indigo-200/90 bg-indigo-50/95 px-2.5 py-1.5 text-[11px] font-medium leading-relaxed text-indigo-900 shadow-md group-hover:block group-focus-within:block"
              >
                To funkcja testowa — sczytywanie listy zębów ze zdjęcia za pomocą AI. Może jeszcze nie działać prawidłowo we wszystkich przypadkach. Wynik zawsze sprawdź przed zapisaniem.
              </span>
            </span>
            <TeethOcrWizard
              open={ocrWizardOpen}
              onClose={() => setOcrWizardOpen(false)}
              disabled={disabled}
              onResult={(ocrGroups, _detectedProductLines, imagePath) => {
                setGroups(ocrGroups.map((g) => ({ ...g })));
                setFromOcr(true);
                setOcrImagePath(imagePath);
              }}
            />
            <div className="ml-auto flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 tabular-nums">
              {kindBreakdown.anterior > 0 ? (
                <span>
                  <span className="text-indigo-700">{kindBreakdown.anterior}</span> prz.
                </span>
              ) : null}
              {kindBreakdown.anterior > 0 && kindBreakdown.posterior > 0 ? (
                <span className="text-slate-300">·</span>
              ) : null}
              {kindBreakdown.posterior > 0 ? (
                <span>
                  <span className="text-indigo-700">{kindBreakdown.posterior}</span> bocz.
                </span>
              ) : null}
              {(kindBreakdown.anterior > 0 || kindBreakdown.posterior > 0) ? (
                <span className="text-slate-300">·</span>
              ) : null}
              <span>
                Razem: <span className="text-indigo-700">{totalCount || 0}</span> szt.
              </span>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={disabled}>
              Anuluj
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={disabled || !listComplete}
              title={saveBlockReason ?? undefined}
              onClick={handleSave}
            >
              Zapisz listę
            </Button>
          </div>
        </div>
      }
    >
      <TeethBuilderWorkspace
        wide={wideLayout}
        steps={steps}
        form={
          <TeethBuilderFormShell
            title={editingId ? "Edytuj pozycję" : "Nowa pozycja"}
            mode={editingId ? "edit" : "new"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && draftComplete) {
                e.preventDefault();
                handleAddOrUpdate();
              } else if (e.key === "Escape" && editingId) {
                e.preventDefault();
                resetDraft();
              }
            }}
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
                onCancelEdit={resetDraft}
              />
            }
          >
            <TeethSpecFields
              productLine={productLine}
              detail={draftSpec}
              lockedKind={defaultKind ?? null}
              disabled={disabled}
              compact
              builderMode
              hidePreview
              onChange={(patch) =>
                setDraft((prev) => ({
                  ...prev,
                  color: patch.color ?? prev.color,
                  mould: patch.mould !== undefined ? patch.mould : prev.mould,
                  jaw: patch.jaw !== undefined ? patch.jaw : prev.jaw,
                  kind: patch.kind !== undefined ? patch.kind : prev.kind,
                  jawMode: patch.jawMode !== undefined ? patch.jawMode : prev.jawMode,
                }))
              }
            />
          </TeethBuilderFormShell>
        }
        list={
          groups.length > 0 ? (
            <TeethBuilderGroupList
              groups={groups}
              editingId={editingId}
              listComplete={listComplete}
              disabled={disabled}
              onEdit={handleEdit}
              onRemove={handleRemove}
              onAddNew={editingId ? resetDraft : undefined}
              addNewLabel={editingId ? "Dodaj nową pozycję" : "+ Dodaj kolejną pozycję"}
            />
          ) : (
            <TeethBuilderEmptyList
              kind={resolvedKind ?? "anterior"}
              productLine={productLine}
              compact
            />
          )
        }
      />
    </ModalShell>
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
