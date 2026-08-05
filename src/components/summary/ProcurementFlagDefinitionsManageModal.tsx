"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { cn } from "@/lib/cn";
import {
  controlFocusClass,
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";
import {
  MAX_PROCUREMENT_FLAG_DEFINITIONS,
  MAX_PROCUREMENT_FLAG_LABEL_LEN,
} from "@/lib/security/text-limits";
import {
  PROCUREMENT_FLAG_COLORS,
  procurementFlagDotClass,
  type ProcurementFlagColor,
  type ProcurementFlagDefinition,
} from "@/lib/orders/procurement-request-flag";
import { PROCUREMENT_REQUEST_FLAG_COPY } from "@/lib/orders/procurement-request-flag-copy";
import {
  actionCreateProcurementFlagDefinition,
  actionDeleteProcurementFlagDefinition,
  actionReorderProcurementFlagDefinitions,
  actionUpdateProcurementFlagDefinition,
} from "@/app/actions/procurement-flag-defs";

type Props = {
  open: boolean;
  definitions: ProcurementFlagDefinition[];
  onClose: () => void;
  onError?: (message: string) => void;
  /** Po udanym zapisie definicji (lista się odświeży). */
  onSuccess?: (message: string) => void;
};

function ColorSwatches({
  value,
  onChange,
  disabled,
}: {
  value: ProcurementFlagColor;
  onChange: (c: ProcurementFlagColor) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {PROCUREMENT_FLAG_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          disabled={disabled}
          title={c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={cn(
            "flex size-6 items-center justify-center rounded-full border",
            value === c ? "border-slate-700 ring-2 ring-slate-300" : "border-slate-200"
          )}
        >
          <span
            className={cn("size-3 rounded-full", procurementFlagDotClass(c))}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}

function DefRow({
  def,
  index,
  total,
  pending,
  showReorder,
  onMove,
  onSave,
  onToggleActive,
  onDelete,
}: {
  def: ProcurementFlagDefinition;
  index: number;
  total: number;
  pending: boolean;
  showReorder: boolean;
  onMove: (dir: -1 | 1) => void;
  onSave: (patch: { label: string; color: ProcurementFlagColor }) => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(def.label);
  const [color, setColor] = useState<ProcurementFlagColor>(def.color);

  const dirty = label.trim() !== def.label || color !== def.color;

  return (
    <li
      className={cn(
        "space-y-2 rounded-md border border-slate-200/80 p-2.5",
        !def.isActive && "bg-slate-50/80 opacity-80"
      )}
    >
      <div className="flex items-start gap-2">
        {showReorder ? (
          <div className="flex shrink-0 flex-col gap-0.5">
            <button
              type="button"
              className="rounded px-1 text-[10px] text-slate-500 hover:bg-slate-100 disabled:opacity-40"
              disabled={pending || index === 0}
              title={PROCUREMENT_REQUEST_FLAG_COPY.manageMoveUp}
              onClick={() => onMove(-1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="rounded px-1 text-[10px] text-slate-500 hover:bg-slate-100 disabled:opacity-40"
              disabled={pending || index >= total - 1}
              title={PROCUREMENT_REQUEST_FLAG_COPY.manageMoveDown}
              onClick={() => onMove(1)}
            >
              ↓
            </button>
          </div>
        ) : null}
        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={label}
            maxLength={MAX_PROCUREMENT_FLAG_LABEL_LEN}
            disabled={pending}
            onChange={(e) => setLabel(e.target.value)}
            className={cn(
              "w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-800",
              controlFocusClass
            )}
          />
          <ColorSwatches
            value={color}
            onChange={setColor}
            disabled={pending}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {dirty ? (
          <Button
            size="sm"
            className="min-h-8 text-[11px]"
            disabled={pending || !label.trim()}
            onClick={() => onSave({ label: label.trim(), color })}
          >
            Zapisz
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          className="min-h-8 text-[11px]"
          disabled={pending}
          onClick={onToggleActive}
        >
          {def.isActive
            ? PROCUREMENT_REQUEST_FLAG_COPY.manageDeactivate
            : PROCUREMENT_REQUEST_FLAG_COPY.manageActivate}
        </Button>
        {!def.isActive ? (
          <Button
            size="sm"
            variant="ghost"
            className="min-h-8 text-[11px] text-rose-700"
            disabled={pending}
            onClick={onDelete}
          >
            {PROCUREMENT_REQUEST_FLAG_COPY.manageDelete}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function ProcurementFlagDefinitionsManageModal({
  open,
  definitions,
  onClose,
  onError,
  onSuccess,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState<ProcurementFlagColor>("rose");

  const sorted = useMemo(
    () => [...definitions].sort((a, b) => a.sortOrder - b.sortOrder),
    [definitions]
  );
  const active = sorted.filter((d) => d.isActive);
  const inactive = sorted.filter((d) => !d.isActive);
  const canAdd = active.length < MAX_PROCUREMENT_FLAG_DEFINITIONS;

  const run = (fn: () => Promise<unknown>, successMessage: string) => {
    startTransition(async () => {
      try {
        await fn();
        onSuccess?.(successMessage);
        router.refresh();
      } catch (e) {
        onError?.(e instanceof Error ? e.message : "Nie udało się zapisać.");
      }
    });
  };

  const reorderActive = (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= active.length) return;
    const next = [...active];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row!);
    const ids = [...next.map((d) => d.id), ...inactive.map((d) => d.id)];
    run(
      () => actionReorderProcurementFlagDefinitions(ids),
      "Zapisano kolejność flag"
    );
  };

  if (!open) return null;

  return (
    <ModalShell
      open
      onClose={onClose}
      title={PROCUREMENT_REQUEST_FLAG_COPY.manageModalTitle}
      titleId="procurement-flag-defs-manage-title"
      size="md"
      tier="raised"
      disableBackdropClose={pending}
      loadingMessage={pending ? "Zapisywanie…" : null}
      bodyClassName="px-5 py-4 sm:px-6"
      footer={
        <Button variant="ghost" className="min-h-11 w-full sm:w-auto" onClick={onClose} disabled={pending}>
          Zamknij
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-slate-600">
          {PROCUREMENT_REQUEST_FLAG_COPY.manageModalHint}
        </p>

        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {active.map((def, index) => (
            <DefRow
              key={`${def.id}:${def.label}:${def.color}:${def.isActive}:${def.sortOrder}`}
              def={def}
              index={index}
              total={active.length}
              pending={pending}
              showReorder
              onMove={(dir) => reorderActive(index, dir)}
              onSave={(patch) =>
                run(
                  () => actionUpdateProcurementFlagDefinition(def.id, patch),
                  "Zapisano flagę"
                )
              }
              onToggleActive={() =>
                run(
                  () =>
                    actionUpdateProcurementFlagDefinition(def.id, {
                      isActive: false,
                    }),
                  "Dezaktywowano flagę"
                )
              }
              onDelete={() =>
                run(
                  () => actionDeleteProcurementFlagDefinition(def.id),
                  "Usunięto flagę z listy"
                )
              }
            />
          ))}
        </ul>

        {inactive.length ? (
          <div className="space-y-2">
            <p className={cn(panelTypography.caption, "font-semibold uppercase")}>
              {PROCUREMENT_REQUEST_FLAG_COPY.manageInactiveSection}
            </p>
            <ul className="max-h-40 space-y-2 overflow-y-auto">
              {inactive.map((def, index) => (
                <DefRow
                  key={`${def.id}:${def.label}:${def.color}:${def.isActive}:${def.sortOrder}`}
                  def={def}
                  index={index}
                  total={inactive.length}
                  pending={pending}
                  showReorder={false}
                  onMove={() => undefined}
                  onSave={(patch) =>
                    run(
                      () => actionUpdateProcurementFlagDefinition(def.id, patch),
                      "Zapisano flagę"
                    )
                  }
                  onToggleActive={() =>
                    run(
                      () =>
                        actionUpdateProcurementFlagDefinition(def.id, {
                          isActive: true,
                        }),
                      "Aktywowano flagę"
                    )
                  }
                  onDelete={() =>
                    run(
                      () => actionDeleteProcurementFlagDefinition(def.id),
                      "Usunięto flagę z listy"
                    )
                  }
                />
              ))}
            </ul>
          </div>
        ) : null}

        <div className="space-y-2 rounded-md border border-dashed border-slate-300 p-3">
          <p className="text-[11px] font-medium text-slate-600">
            {PROCUREMENT_REQUEST_FLAG_COPY.manageAdd}
            {!canAdd
              ? ` (limit ${MAX_PROCUREMENT_FLAG_DEFINITIONS})`
              : null}
          </p>
          <input
            value={newLabel}
            maxLength={MAX_PROCUREMENT_FLAG_LABEL_LEN}
            disabled={pending || !canAdd}
            placeholder={PROCUREMENT_REQUEST_FLAG_COPY.manageLabelPlaceholder}
            onChange={(e) => setNewLabel(e.target.value)}
            className={cn(
              "w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800",
              controlFocusClass
            )}
          />
          <ColorSwatches
            value={newColor}
            onChange={setNewColor}
            disabled={pending || !canAdd}
          />
          <Button
            className={cn(panelChoiceChipClass, panelChoiceChipIdleClass, "min-h-9")}
            disabled={pending || !canAdd || !newLabel.trim()}
            onClick={() =>
              run(async () => {
                await actionCreateProcurementFlagDefinition({
                  label: newLabel,
                  color: newColor,
                });
                setNewLabel("");
                setNewColor("rose");
              }, "Dodano flagę")
            }
          >
            {PROCUREMENT_REQUEST_FLAG_COPY.manageAdd}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
