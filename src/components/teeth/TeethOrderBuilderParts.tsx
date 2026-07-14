"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import {
  TEETH_BUILDER_BOTH_JAW_HINT,
  TEETH_BUILDER_EMPTY_LIST_TITLE,
  teethBuilderEmptyListExample,
  type TeethBuilderStep,
} from "@/lib/teeth/teeth-builder-copy";
import {
  TEETH_KIND_LABELS,
  type TeethGroupDraft,
  type TeethKind,
  type TeethProductLine,
} from "@/lib/teeth/teeth-catalog";
import { jawRequiredForKind, mouldShapeGroupsFor } from "@/lib/teeth/teeth-mould-shape-groups";
import { teethColorSwatch } from "@/lib/teeth/teeth-color-swatches";
import type { ModalSize } from "@/components/ui/ModalShell";
import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import { IconAlertCircle, IconPlusCircle, IconPencil } from "@/components/icons/StrokeIcons";

/** Spójny styl komunikatu ostrzegawczego w modalu zębów. */
export const teethBuilderAlertClass =
  "flex items-center gap-1.5 rounded-md border border-amber-200/80 bg-amber-50/80 px-2 py-1 text-[11px] font-medium text-amber-800";

export function teethBuilderModalSize(
  productLine: TeethProductLine,
  kind: TeethKind | null,
): ModalSize {
  if (!kind) return "md";
  return mouldShapeGroupsFor(productLine, kind).length > 1 ? "lg" : "md";
}

export function TeethBuilderWorkspace({
  steps,
  form,
  list,
  wide = false,
}: {
  steps: TeethBuilderStep[];
  form: ReactNode;
  list: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="space-y-2.5">
      <TeethBuilderStepFlow steps={steps} />
      <div
        className={cn(
          "grid gap-3",
          wide && "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.84fr)] lg:items-start lg:gap-4",
        )}
      >
        <div className="min-w-0">{form}</div>
        <div className={cn("min-w-0", wide && "lg:sticky lg:top-0")}>{list}</div>
      </div>
    </div>
  );
}

export function TeethBuilderStepFlow({ steps }: { steps: TeethBuilderStep[] }) {
  const handleStepClick = (stepKey?: string) => {
    if (!stepKey) return;
    const el = document.querySelector<HTMLElement>(`[data-step="${stepKey}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
    }
  };

  return (
    <ol
      className="flex flex-wrap items-center gap-1"
      aria-label="Kroki uzupełniania pozycji"
    >
      {steps.map((step, index) => (
        <li key={step.label} className="flex items-center gap-1">
          {index > 0 ? (
            <span className="px-0.5 text-[10px] text-slate-300" aria-hidden="true">
              /
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => handleStepClick(step.stepKey)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none transition",
              "hover:ring-2 hover:ring-indigo-200/50",
              step.done
                ? "bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200/70"
                : "text-slate-400 hover:text-slate-600",
            )}
          >
            <span
              className={cn(
                "flex size-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                step.done ? "bg-indigo-600 text-white" : "bg-slate-200/80 text-slate-500",
              )}
              aria-hidden="true"
            >
              {step.done ? "✓" : step.number}
            </span>
            {step.label}
          </button>
        </li>
      ))}
    </ol>
  );
}

export function TeethBuilderEmptyList({
  kind,
  productLine,
  variant = "neutral",
  compact,
}: {
  kind: TeethKind;
  productLine: TeethProductLine;
  variant?: "neutral" | "accent";
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed px-3 text-center",
        compact ? "py-2.5" : "py-3",
        variant === "accent"
          ? "border-indigo-200/70 bg-indigo-50/30"
          : "border-slate-200/80 bg-slate-50/40",
      )}
    >
      <div className="flex flex-col items-center gap-1.5">
        <IconPlusCircle size={20} className="text-indigo-400" />
        <p className="text-[11px] font-medium text-slate-600">{TEETH_BUILDER_EMPTY_LIST_TITLE}</p>
        <p className="text-[10px] leading-snug text-slate-500">
          {teethBuilderEmptyListExample(kind, productLine)}
        </p>
        <p className="text-[10px] font-medium text-indigo-600">Wypełnij formularz powyżej ↑</p>
      </div>
    </div>
  );
}

export function TeethBuilderGroupList({
  groups,
  lockedKind,
  editingId,
  listComplete,
  disabled,
  dense,
  onEdit,
  onRemove,
  onAddNew,
  addNewLabel = "Dodaj nową pozycję",
}: {
  groups: TeethGroupDraft[];
  lockedKind?: TeethKind | null;
  editingId: string | null;
  listComplete: boolean;
  disabled?: boolean;
  dense?: boolean;
  onEdit: (group: TeethGroupDraft) => void;
  onRemove: (id: string) => void;
  onAddNew?: () => void;
  addNewLabel?: string;
}) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Lista · {groups.length}
        </h3>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[10px] font-medium",
              listComplete ? "text-indigo-600" : "text-amber-700",
            )}
          >
            {!listComplete && <IconAlertCircle size={11} />}
            <span
              className={cn(
                "size-1.5 rounded-full",
                listComplete ? "bg-indigo-500" : "bg-amber-500",
              )}
              aria-hidden
            />
            {listComplete ? "Gotowe" : "Uzupełnij"}
          </span>
        </div>
      </div>
      <ul
        className={cn(
          "divide-y divide-indigo-100/50 overflow-y-auto rounded-lg ring-1 ring-indigo-100/80",
          dense ? "max-h-36" : "max-h-44",
        )}
      >
        {groups.map((g) => {
          const effectiveKind = lockedKind ?? g.kind;
          const needsJaw = jawRequiredForKind(effectiveKind);
          const jawIcon = g.jaw === "upper" ? "↑" : g.jaw === "lower" ? "↓" : null;
          const swatch = teethColorSwatch(g.color);
          return (
          <li
            key={g.id}
            className={cn(
              "flex items-center gap-2 bg-white px-2.5 py-1.5",
              editingId === g.id && "bg-amber-50/70 ring-1 ring-inset ring-amber-200/60",
            )}
          >
            <span
              className="size-3.5 shrink-0 rounded-full border border-slate-300/60"
              style={{ backgroundColor: swatch ?? "#E8D5B7" }}
              title={g.color || "Brak koloru"}
              aria-hidden
            />
            <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span className="text-xs font-semibold text-slate-800">
                {g.color?.trim() || "?"}
              </span>
              {g.mould?.trim() ? (
                <span className="text-xs font-medium text-slate-700">{g.mould.trim()}</span>
              ) : null}
              {needsJaw && jawIcon ? (
                <span className="text-xs font-bold text-slate-500" title={g.jaw === "upper" ? "Górna" : "Dolna"}>
                  {jawIcon}
                </span>
              ) : null}
              {effectiveKind ? (
                <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-medium text-slate-500">
                  {TEETH_KIND_LABELS[effectiveKind].toLowerCase()}
                </span>
              ) : null}
              <span className="ml-auto font-semibold tabular-nums text-slate-500">
                × {g.count}
              </span>
            </div>
            <div className="flex shrink-0 gap-0.5">
              <ListActionButton
                label="Edytuj"
                disabled={disabled}
                onClick={() => onEdit(g)}
              />
              <ListActionButton
                label="Usuń"
                tone="danger"
                disabled={disabled}
                onClick={() => onRemove(g.id)}
              />
            </div>
          </li>
          );
        })}
      </ul>
      {onAddNew ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onAddNew}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-indigo-300/70 bg-indigo-50/30 px-3 py-2 text-xs font-semibold text-indigo-700 transition",
            "hover:border-indigo-400 hover:bg-indigo-50/60",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <IconPlusCircle size={14} />
          {addNewLabel}
        </button>
      ) : null}
    </section>
  );
}

function ListActionButton({
  label,
  tone = "default",
  disabled,
  onClick,
}: {
  label: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-40",
        tone === "danger"
          ? "text-rose-600 hover:bg-rose-50"
          : "text-indigo-700 hover:bg-indigo-50",
      )}
    >
      {label}
    </button>
  );
}

export function TeethBuilderQuantityRow({
  count,
  disabled,
  draftComplete,
  editingId,
  jawModeBoth,
  onCountChange,
  onAddOrUpdate,
  onCancelEdit,
}: {
  count: number;
  disabled?: boolean;
  draftComplete: boolean;
  editingId: string | null;
  jawModeBoth?: boolean;
  onCountChange: (count: number) => void;
  onAddOrUpdate: () => void;
  onCancelEdit?: () => void;
}) {
  return (
    <div className="space-y-1.5 border-t border-indigo-100/60 pt-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Ilość
          </span>
          <div className="flex items-center rounded-md ring-1 ring-slate-200/90">
            <QuantityStepButton
              label="−"
              disabled={disabled || count <= 1}
              onClick={() => onCountChange(Math.max(1, count - 1))}
            />
            <input
              type="number"
              min={1}
              max={99}
              disabled={disabled}
              value={count}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                onCountChange(Number.isFinite(n) && n >= 1 ? Math.min(99, n) : 1);
              }}
              className={cn(
                "w-11 border-x border-slate-200/90 bg-white py-1 text-center text-xs font-semibold tabular-nums",
                controlFocusClass,
              )}
              aria-label="Ilość sztuk tej pozycji"
            />
            <QuantityStepButton
              label="+"
              disabled={disabled || count >= 99}
              onClick={() => onCountChange(Math.min(99, count + 1))}
            />
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {editingId && onCancelEdit ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCancelEdit} disabled={disabled}>
              Anuluj
            </Button>
          ) : null}
          <Button
            type="button"
            variant={draftComplete ? "primary" : "outline"}
            size="sm"
            disabled={disabled || !draftComplete}
            onClick={onAddOrUpdate}
          >
            {editingId ? "Zapisz pozycję" : "Dodaj do listy"}
          </Button>
        </div>
      </div>
      {jawModeBoth ? (
        <p className="text-[10px] leading-snug text-indigo-700/90" role="status">
          {TEETH_BUILDER_BOTH_JAW_HINT}
        </p>
      ) : null}
    </div>
  );
}

export function TeethBuilderFormShell({
  title,
  mode = "new",
  headerAction,
  children,
  footer,
  onKeyDown,
}: {
  title: string;
  mode?: "new" | "edit";
  headerAction?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}) {
  const isNew = mode === "new";
  return (
    <section
      className={cn(
        "space-y-2.5 rounded-lg border p-3 transition-colors",
        isNew
          ? "border-indigo-200/70 bg-indigo-50/30"
          : "border-amber-200/70 bg-amber-50/30",
      )}
      onKeyDown={onKeyDown}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-1.5">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
          {isNew ? (
            <IconPlusCircle size={14} className="text-indigo-600" />
          ) : (
            <IconPencil size={14} className="text-amber-600" />
          )}
          {title}
        </h3>
        {headerAction}
      </div>
      {children}
      {footer}
    </section>
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
        "flex size-7 items-center justify-center text-sm font-semibold text-slate-600",
        "hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40",
      )}
      aria-label={label === "+" ? "Zwiększ ilość" : "Zmniejsz ilość"}
    >
      {label}
    </button>
  );
}
