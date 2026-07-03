"use client";

import { useMemo, useState } from "react";
import { mouldShapeGroupsFor, catalogUsesFixedMouldColumns } from "@/lib/teeth/teeth-mould-shape-groups";
import { TEETH_CHIP_OTHER } from "@/lib/teeth/teeth-catalog";
import type { TeethKind, TeethProductLine } from "@/lib/teeth/teeth-catalog-types";
import type { TeethMouldShapeGroup, TeethMouldShapeId } from "@/lib/teeth/teeth-mould-shape-groups";
import { cn } from "@/lib/cn";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
  controlFocusClass,
} from "@/lib/ui/ontime-theme";
import { TeethMouldShapeIcon } from "@/components/teeth/TeethMouldShapeIcons";

function mouldIsCustom(mould: string | null | undefined, palette: readonly string[]): boolean {
  const t = mould?.trim() ?? "";
  return t.length > 0 && !palette.includes(t) && t !== TEETH_CHIP_OTHER;
}

export function TeethMouldShapePicker({
  productLine,
  kind,
  mould,
  onMouldChange,
  disabled,
  compact,
  required,
  builderMode = false,
}: {
  productLine: TeethProductLine;
  kind: TeethKind;
  mould: string | null;
  onMouldChange: (mould: string | null) => void;
  disabled?: boolean;
  compact?: boolean;
  required?: boolean;
  builderMode?: boolean;
}) {
  const groups = useMemo(() => {
    const raw = mouldShapeGroupsFor(productLine, kind);
    if (raw.length <= 1 || catalogUsesFixedMouldColumns(productLine)) return raw;
    return raw;
  }, [productLine, kind]);
  const allMoulds = useMemo(() => groups.flatMap((g) => g.moulds), [groups]);
  const groupedLayout = groups.length > 1;
  const chipPad = builderMode || compact ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs";

  const [customMouldOpen, setCustomMouldOpen] = useState(false);

  const onPalette = !!(mould?.trim() && allMoulds.includes(mould.trim()));
  const customMouldActive = mouldIsCustom(mould, allMoulds) || (customMouldOpen && !onPalette);

  const selectMould = (code: string) => {
    if (disabled) return;
    setCustomMouldOpen(false);
    onMouldChange(code);
  };

  const selectOther = () => {
    if (disabled) return;
    setCustomMouldOpen(true);
    if (!customMouldActive) onMouldChange("");
  };

  return (
    <div className={cn("space-y-1.5", compact && "space-y-1")}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Fason
        {required && !mould?.trim() ? <span className="ml-0.5 text-rose-500">*</span> : null}
      </p>

      {groupedLayout ? (
        <GroupedMouldSections
          groups={groups}
          mould={mould}
          customMouldActive={customMouldActive}
          disabled={disabled}
          compact={compact || builderMode}
          chipPad={chipPad}
          onSelectMould={selectMould}
          onSelectOther={selectOther}
        />
      ) : (
        <div className="flex flex-wrap gap-1">
          {(groups[0]?.moulds ?? []).map((code) => (
            <MouldChip
              key={code}
              label={code}
              selected={!customMouldActive && mould === code}
              disabled={disabled}
              className={chipPad}
              onSelect={() => selectMould(code)}
            />
          ))}
          <MouldChip
            label={TEETH_CHIP_OTHER}
            selected={customMouldActive}
            disabled={disabled}
            className={chipPad}
            onSelect={selectOther}
          />
        </div>
      )}

      {customMouldActive ? (
        <input
          type="text"
          value={mouldIsCustom(mould, allMoulds) ? (mould ?? "") : ""}
          disabled={disabled}
          onChange={(e) => onMouldChange(e.target.value || null)}
          placeholder="Wpisz fason spoza listy"
          className={cn(
            "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs",
            controlFocusClass,
            "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          )}
        />
      ) : null}
    </div>
  );
}

function GroupedMouldSections({
  groups,
  mould,
  customMouldActive,
  disabled,
  compact,
  chipPad,
  onSelectMould,
  onSelectOther,
}: {
  groups: TeethMouldShapeGroup[];
  mould: string | null;
  customMouldActive: boolean;
  disabled?: boolean;
  compact?: boolean;
  chipPad: string;
  onSelectMould: (code: string) => void;
  onSelectOther: () => void;
}) {
  return (
    <div className="rounded-lg bg-white ring-1 ring-indigo-100/80">
      <div
        className={cn(
          "flex gap-1.5 overflow-x-auto p-1.5",
          compact ? "max-h-48" : "max-h-56",
        )}
      >
        {groups.map((group) => (
          <section
            key={`${group.shapeId}-${group.label}`}
            className="flex min-w-[4.5rem] flex-1 flex-col rounded-md ring-1 ring-indigo-100/50 overflow-hidden"
            aria-label={group.label}
          >
            <ShapeSectionHeader group={group} compact={compact} />
            <div className="flex flex-1 flex-wrap content-start gap-0.5 overflow-y-auto p-1">
              {group.moulds.map((code) => (
                <MouldChip
                  key={code}
                  label={code}
                  selected={!customMouldActive && mould === code}
                  disabled={disabled}
                  className={chipPad}
                  onSelect={() => onSelectMould(code)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 border-t border-indigo-100/60 bg-slate-50/30 p-1.5">
        <MouldChip
          label={TEETH_CHIP_OTHER}
          selected={customMouldActive}
          disabled={disabled}
          className={chipPad}
          onSelect={onSelectOther}
        />
      </div>
    </div>
  );
}

function ShapeSectionHeader({
  group,
  compact,
}: {
  group: TeethMouldShapeGroup;
  compact?: boolean;
}) {
  const showIcon = group.shapeId !== "all";

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center gap-0.5 border-b border-indigo-100/50 bg-indigo-50/25 px-1 text-center",
        compact ? "py-1" : "py-1.5",
      )}
    >
      {showIcon ? (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white text-slate-500 ring-1 ring-indigo-100/80">
          <TeethMouldShapeIcon
            shapeId={group.shapeId as Exclude<TeethMouldShapeId, "all">}
            className="size-3.5"
          />
        </span>
      ) : null}
      <p className="text-[9px] font-semibold uppercase leading-tight tracking-wide text-slate-600">
        {group.label}
      </p>
      {group.hint ? (
        <p className="text-[8px] leading-tight text-slate-400">{group.hint}</p>
      ) : null}
    </div>
  );
}

function MouldChip({
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
        "font-semibold tabular-nums",
        className,
        selected ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass,
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {label}
    </button>
  );
}
