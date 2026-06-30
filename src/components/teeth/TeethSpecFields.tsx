"use client";

import { useMemo, useState } from "react";
import {
  teethColorsFor,
  toothMouldsFor,
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
import { cn } from "@/lib/cn";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
  controlFocusClass,
} from "@/lib/ui/ontime-theme";

function colorIsCustom(color: string, palette: readonly string[]): boolean {
  const t = color.trim();
  return t.length > 0 && !palette.includes(t) && t !== TEETH_CHIP_OTHER;
}

function mouldIsCustom(mould: string | null | undefined, palette: readonly string[]): boolean {
  const t = mould?.trim() ?? "";
  return t.length > 0 && !palette.includes(t) && t !== TEETH_CHIP_OTHER;
}

export function TeethSpecFields({
  productLine,
  detail,
  onChange,
  disabled,
  lockedKind,
  compact,
}: {
  productLine: TeethProductLine;
  detail: Pick<TeethLineDetail, "color" | "mould" | "jaw" | "kind">;
  onChange: (patch: Partial<TeethLineDetail>) => void;
  disabled?: boolean;
  lockedKind?: TeethKind | null;
  compact?: boolean;
}) {
  const catalog = useMemo<TeethCatalogRef>(() => ({ productLine }), [productLine]);
  const colors = useMemo(() => teethColorsFor(catalog), [catalog]);
  const jaw = (detail.jaw ?? null) as TeethJaw | null;
  const kind = (detail.kind ?? null) as TeethKind | null;
  const moulds = useMemo(
    () => (kind ? toothMouldsFor(catalog, kind) : []),
    [catalog, kind],
  );
  const showMouldChips = kind != null && hasMouldsForKind(catalog, kind);
  const freeformMould = lineOptionalMould(productLine);
  const mouldRequired = kind != null && mouldRequiredForKind(catalog, kind);

  const [customColorOpen, setCustomColorOpen] = useState(() =>
    colorIsCustom(detail.color, colors),
  );
  const [customMouldOpen, setCustomMouldOpen] = useState(() =>
    mouldIsCustom(detail.mould, moulds),
  );

  const customColorActive = customColorOpen || colorIsCustom(detail.color, colors);
  const customMouldActive = customMouldOpen || mouldIsCustom(detail.mould, moulds);

  const isComplete = isTeethDetailComplete(
    { position: 1, color: detail.color, mould: detail.mould, jaw: detail.jaw, kind: detail.kind },
    catalog,
  );

  const handleJaw = (j: TeethJaw) => {
    if (disabled) return;
    onChange({ jaw: j });
  };

  const handleKind = (k: TeethKind) => {
    if (disabled) return;
    const next: Partial<TeethLineDetail> = { kind: k };
    if (k !== kind) next.mould = null;
    onChange(next);
    setCustomMouldOpen(false);
  };

  const chipPad = compact ? "px-2 py-0.5 text-xs" : "px-2 py-0.5 text-xs";
  const sectionGap = compact ? "space-y-2.5" : "space-y-3";

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      <div className={sectionGap}>
        <FieldLabel required={!jaw}>Szczęka</FieldLabel>
        <div className="flex gap-2">
          <ChoiceButton label="Górna" selected={jaw === "upper"} disabled={disabled} onClick={() => handleJaw("upper")} />
          <ChoiceButton label="Dolna" selected={jaw === "lower"} disabled={disabled} onClick={() => handleJaw("lower")} />
        </div>
      </div>

      {lockedKind ? (
        <div className={sectionGap}>
          <FieldLabel>Typ</FieldLabel>
          <span className={cn(panelChoiceChipClass, "px-4 py-1.5 text-sm", panelChoiceChipSelectedClass)}>
            {TEETH_KIND_LABELS[lockedKind]}
          </span>
        </div>
      ) : (
        <div className={sectionGap}>
          <FieldLabel required={!kind}>Typ</FieldLabel>
          <div className="flex gap-2">
            <ChoiceButton
              label={TEETH_KIND_LABELS.anterior}
              selected={kind === "anterior"}
              disabled={disabled}
              onClick={() => handleKind("anterior")}
            />
            <ChoiceButton
              label={TEETH_KIND_LABELS.posterior}
              selected={kind === "posterior"}
              disabled={disabled}
              onClick={() => handleKind("posterior")}
            />
          </div>
        </div>
      )}

      <div className={sectionGap}>
        <FieldLabel required={!detail.color.trim()}>Kolor</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
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
              "mt-1.5 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm",
              controlFocusClass,
              "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
            )}
          />
        ) : null}
      </div>

      {showMouldChips ? (
        <div className={sectionGap}>
          <FieldLabel required={mouldRequired && !detail.mould?.trim()}>Fason / wielkość</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {moulds.map((m) => (
              <ChipButton
                key={m}
                label={m}
                selected={!customMouldActive && detail.mould === m}
                disabled={disabled}
                className={chipPad}
                onSelect={() => {
                  if (disabled) return;
                  setCustomMouldOpen(false);
                  onChange({ mould: m });
                }}
              />
            ))}
            <ChipButton
              label={TEETH_CHIP_OTHER}
              selected={customMouldActive}
              disabled={disabled}
              className={chipPad}
              onSelect={() => {
                if (disabled) return;
                setCustomMouldOpen(true);
                if (!customMouldActive) onChange({ mould: "" });
              }}
            />
          </div>
          {customMouldActive ? (
            <input
              type="text"
              value={mouldIsCustom(detail.mould, moulds) ? (detail.mould ?? "") : ""}
              disabled={disabled}
              onChange={(e) => onChange({ mould: e.target.value || null })}
              placeholder="Wpisz fason spoza listy"
              className={cn(
                "mt-1.5 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm",
                controlFocusClass,
                "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
              )}
            />
          ) : null}
        </div>
      ) : kind != null ? (
        <div className={sectionGap}>
          <FieldLabel required={false}>Fason / wielkość</FieldLabel>
          <input
            type="text"
            value={detail.mould ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ mould: e.target.value || null })}
            placeholder={freeformMould ? "Wpisz fason (opcjonalnie)" : "Wpisz fason lub zostaw puste"}
            className={cn(
              "w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm",
              controlFocusClass,
              "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
            )}
          />
        </div>
      ) : null}

      {detail.color || jaw || kind ? (
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

export function TeethSpecPreview({
  detail,
}: {
  detail: Pick<TeethLineDetail, "color" | "mould" | "jaw" | "kind">;
}) {
  const parts: string[] = [];
  if (detail.jaw === "upper") parts.push("Górna");
  else if (detail.jaw === "lower") parts.push("Dolna");
  if (detail.kind) parts.push(TEETH_KIND_LABELS[detail.kind]);
  if (detail.color) parts.push(detail.color);
  if (detail.mould) parts.push(detail.mould);
  if (parts.length === 0) return <span className="text-slate-400">Wybierz parametry</span>;
  return <span>{parts.join(" · ")}</span>;
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {children}
      {required ? <span className="ml-1 text-rose-500">*</span> : null}
    </p>
  );
}

function ChoiceButton({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
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
        "px-4 py-1.5 text-sm",
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
