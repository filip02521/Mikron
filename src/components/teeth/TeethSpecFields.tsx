"use client";

import { useMemo, useState } from "react";
import {
  teethColorsFor,
  hasMouldsForKind,
  isTeethDetailComplete,
  mouldRequiredForKind,
  lineOptionalMould,
  TEETH_KIND_LABELS,
  TEETH_CHIP_OTHER,
  type TeethCatalogRef,
  type TeethLineDetail,
  type TeethJaw,
  type TeethKind,
  type TeethProductLine,
} from "@/lib/teeth/teeth-catalog";
import {
  shouldShowJawPicker,
  isJawModeSatisfied,
  type TeethJawMode,
} from "@/lib/teeth/teeth-mould-shape-groups";
import { TeethMouldShapePicker } from "@/components/teeth/TeethMouldShapePicker";
import { cn } from "@/lib/cn";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
  controlFocusClass,
} from "@/lib/ui/ontime-theme";

export type TeethSpecFieldsDetail = Pick<TeethLineDetail, "color" | "mould" | "jaw" | "kind"> & {
  jawMode?: TeethJawMode | null;
};

function colorIsCustom(color: string, palette: readonly string[]): boolean {
  const t = color.trim();
  return t.length > 0 && !palette.includes(t) && t !== TEETH_CHIP_OTHER;
}

export function TeethSpecFields({
  productLine,
  detail,
  onChange,
  disabled,
  lockedKind,
  compact,
  hideKindField = false,
  hidePreview = false,
  allowJawBoth = true,
  builderMode = false,
}: {
  productLine: TeethProductLine;
  detail: TeethSpecFieldsDetail;
  onChange: (patch: Partial<TeethSpecFieldsDetail>) => void;
  disabled?: boolean;
  lockedKind?: TeethKind | null;
  compact?: boolean;
  hideKindField?: boolean;
  /** Ukryj podgląd w builderze listy — kroki breadcrumb już pokazują postęp. */
  hidePreview?: boolean;
  /** „Oba” tylko w builderze listy — w inline pickerze tworzyłoby jedną niekompletną pozycję. */
  allowJawBoth?: boolean;
  /** Ciaśniejszy układ w modalu listy zębów. */
  builderMode?: boolean;
}) {
  const catalog = useMemo<TeethCatalogRef>(() => ({ productLine }), [productLine]);
  const colors = useMemo(() => teethColorsFor(catalog), [catalog]);
  const jaw = (detail.jaw ?? null) as TeethJaw | null;
  const jawMode = detail.jawMode ?? null;
  const kind = (detail.kind ?? null) as TeethKind | null;
  const showMouldChips = kind != null && hasMouldsForKind(catalog, kind);
  const freeformMould = lineOptionalMould(productLine);
  const mouldRequired = kind != null && mouldRequiredForKind(catalog, kind);
  const showJaw = shouldShowJawPicker(kind);

  const [customColorOpen, setCustomColorOpen] = useState(() =>
    colorIsCustom(detail.color, colors),
  );

  const customColorActive = customColorOpen || colorIsCustom(detail.color, colors);

  const isComplete =
    kind != null &&
    isJawModeSatisfied(kind, jaw, jawMode) &&
    isTeethDetailComplete(
      {
        position: 1,
        color: detail.color,
        mould: detail.mould,
        jaw:
          kind === "posterior"
            ? jawMode === "both"
              ? "upper"
              : jawMode === "upper" || jawMode === "lower"
                ? jawMode
                : jaw
            : null,
        kind,
      },
      catalog,
    );

  const handleJawMode = (mode: TeethJawMode) => {
    if (disabled) return;
    if (mode === "both") {
      onChange({ jawMode: "both", jaw: null });
    } else {
      onChange({ jawMode: mode, jaw: mode });
    }
  };

  const handleKind = (k: TeethKind) => {
    if (disabled) return;
    const next: Partial<TeethSpecFieldsDetail> = { kind: k };
    if (k !== kind) {
      next.mould = null;
      if (k === "anterior") {
        next.jaw = null;
        next.jawMode = null;
      } else {
        next.jaw = null;
        next.jawMode = null;
      }
    }
    onChange(next);
  };

  const tight = builderMode || compact;
  const chipPad = tight ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs";
  const sectionGap = tight ? "space-y-1.5" : "space-y-3";
  const choicePad = tight ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm";

  return (
    <div className={cn(tight ? "space-y-2" : "space-y-3")}>
      {hideKindField ? null : lockedKind ? (
        <div className={sectionGap} data-step="kind">
          <FieldLabel>Typ</FieldLabel>
          <span className={cn(panelChoiceChipClass, choicePad, panelChoiceChipSelectedClass)}>
            {TEETH_KIND_LABELS[lockedKind]}
          </span>
        </div>
      ) : (
        <div className={sectionGap} data-step="kind">
          <FieldLabel required={!kind}>Typ</FieldLabel>
          <div className="flex gap-2">
            <ChoiceButton
              label={TEETH_KIND_LABELS.anterior}
              selected={kind === "anterior"}
              disabled={disabled}
              className={choicePad}
              onClick={() => handleKind("anterior")}
            />
            <ChoiceButton
              label={TEETH_KIND_LABELS.posterior}
              selected={kind === "posterior"}
              disabled={disabled}
              className={choicePad}
              onClick={() => handleKind("posterior")}
            />
          </div>
        </div>
      )}

      <div className={sectionGap} data-step="color">
        <FieldLabel required={!detail.color.trim()}>Kolor</FieldLabel>
        <div className="flex flex-wrap gap-1">
          {colors.map((c) => (
            <ChipButton
              key={c}
              label={c}
              selected={!customColorActive && detail.color === c}
              disabled={disabled}
              className={chipPad}
              onSelect={() => {
                if (disabled) return;
                setCustomColorOpen(false);
                onChange({ color: c });
              }}
            />
          ))}
          <ChipButton
            label={TEETH_CHIP_OTHER}
            selected={customColorActive}
            disabled={disabled}
            className={chipPad}
            onSelect={() => {
              if (disabled) return;
              setCustomColorOpen(true);
              if (!customColorActive) onChange({ color: "" });
            }}
          />
        </div>
        {customColorActive ? (
          <input
            type="text"
            value={colorIsCustom(detail.color, colors) ? detail.color : ""}
            disabled={disabled}
            onChange={(e) => onChange({ color: e.target.value })}
            placeholder="Wpisz kolor spoza listy"
            className={cn(
              "mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs",
              controlFocusClass,
              "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
            )}
          />
        ) : null}
      </div>

      {showMouldChips && kind ? (
        <div data-step="mould">
        <TeethMouldShapePicker
          key={`${productLine}-${kind}`}
          productLine={productLine}
          kind={kind}
          mould={detail.mould ?? null}
          onMouldChange={(m) => onChange({ mould: m })}
          disabled={disabled}
          compact={compact}
          builderMode={builderMode}
          required={mouldRequired}
        />
        </div>
      ) : kind != null ? (
        <div className={sectionGap} data-step="mould">
          <FieldLabel required={false}>Fason / wielkość</FieldLabel>
          <input
            type="text"
            value={detail.mould ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ mould: e.target.value || null })}
            placeholder={freeformMould ? "Wpisz fason (opcjonalnie)" : "Wpisz fason lub zostaw puste"}
            className={cn(
              "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs",
              controlFocusClass,
              "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
            )}
          />
        </div>
      ) : null}

      {showJaw ? (
        <div className={sectionGap} data-step="jaw">
          <FieldLabel required={!isJawModeSatisfied(kind, jaw, jawMode)}>Szczęka</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            <ChoiceButton
              label="Górna"
              selected={jawMode === "upper" || (!jawMode && jaw === "upper")}
              disabled={disabled}
              className={choicePad}
              onClick={() => handleJawMode("upper")}
            />
            <ChoiceButton
              label="Dolna"
              selected={jawMode === "lower" || (!jawMode && jaw === "lower")}
              disabled={disabled}
              className={choicePad}
              onClick={() => handleJawMode("lower")}
            />
            {allowJawBoth ? (
              <ChoiceButton
                label="Oba"
                selected={jawMode === "both"}
                disabled={disabled}
                className={choicePad}
                onClick={() => handleJawMode("both")}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {!hidePreview && (detail.color || jaw || jawMode || kind) ? (
        <div
          className={cn(
            "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium",
            isComplete ? "bg-indigo-50 text-indigo-800" : "bg-slate-50 text-slate-600",
          )}
        >
          {isComplete ? (
            <svg className="h-3.5 w-3.5 shrink-0 text-indigo-500" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                clipRule="evenodd"
              />
            </svg>
          ) : null}
          <TeethSpecPreview detail={detail} />
        </div>
      ) : null}
    </div>
  );
}

export function TeethSpecPreview({ detail }: { detail: TeethSpecFieldsDetail }) {
  const parts: string[] = [];
  if (detail.kind === "posterior") {
    if (detail.jawMode === "both") parts.push("Oba");
    else if (detail.jaw === "upper") parts.push("Górna");
    else if (detail.jaw === "lower") parts.push("Dolna");
  }
  if (detail.kind) parts.push(TEETH_KIND_LABELS[detail.kind]);
  if (detail.color) parts.push(detail.color);
  if (detail.mould) parts.push(detail.mould);
  if (parts.length === 0) return <span className="text-slate-400">Wybierz parametry</span>;
  return <span>{parts.join(" · ")}</span>;
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
      {children}
      {required ? <span className="ml-1 text-rose-500">*</span> : null}
    </p>
  );
}

function ChoiceButton({
  label,
  selected,
  disabled,
  className,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        panelChoiceChipClass,
        className ?? "px-4 py-1.5 text-sm",
        selected ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass,
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {label}
    </button>
  );
}

function ChipButton({
  label,
  selected,
  disabled,
  className,
  onSelect,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  className?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        panelChoiceChipClass,
        className,
        selected ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass,
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {label}
    </button>
  );
}
