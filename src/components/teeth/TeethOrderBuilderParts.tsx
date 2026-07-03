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
  formatTeethGroupLabel,
  type TeethGroupDraft,
  type TeethKind,
  type TeethProductLine,
} from "@/lib/teeth/teeth-catalog";
import { mouldShapeGroupsFor } from "@/lib/teeth/teeth-mould-shape-groups";
import type { ModalSize } from "@/components/ui/ModalShell";
import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";

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
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none",
              step.done
                ? "bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200/70"
                : "text-slate-400",
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
          </span>
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
      <p className="text-[11px] font-medium text-slate-600">{TEETH_BUILDER_EMPTY_LIST_TITLE}</p>
      <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
        {teethBuilderEmptyListExample(kind, productLine)}
      </p>
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
}: {
  groups: TeethGroupDraft[];
  lockedKind?: TeethKind | null;
  editingId: string | null;
  listComplete: boolean;
  disabled?: boolean;
  dense?: boolean;
  onEdit: (group: TeethGroupDraft) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Lista · {groups.length}
        </h3>
        <span
          className={cn(
            "text-[10px] font-medium",
            listComplete ? "text-indigo-600" : "text-amber-600",
          )}
        >
          {listComplete ? "Gotowe" : "Uzupełnij"}
        </span>
      </div>
      <ul
        className={cn(
          "divide-y divide-indigo-100/50 overflow-y-auto rounded-lg ring-1 ring-indigo-100/80",
          dense ? "max-h-36" : "max-h-44",
        )}
      >
        {groups.map((g) => (
          <li
            key={g.id}
            className={cn(
              "flex items-center gap-2 bg-white px-2.5 py-1.5",
              editingId === g.id && "bg-indigo-50/70",
            )}
          >
            <p className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800">
              {formatTeethGroupLabel(lockedKind ? { ...g, kind: lockedKind } : g)}
              <span className="ml-1.5 font-semibold tabular-nums text-slate-500">
                × {g.count}
              </span>
            </p>
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
        ))}
      </ul>
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
  headerAction,
  children,
  footer,
}: {
  title: string;
  headerAction?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 border-b border-indigo-100/60 pb-1.5">
        <h3 className="text-xs font-semibold text-slate-800">{title}</h3>
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
