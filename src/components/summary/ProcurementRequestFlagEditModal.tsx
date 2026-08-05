"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { cn } from "@/lib/cn";
import {
  controlFocusClass,
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";
import { MAX_PROCUREMENT_FLAG_NOTE_LEN } from "@/lib/security/text-limits";
import {
  findFlagDefinition,
  procurementFlagDotClass,
  procurementFlagModalChipSelectedClass,
  type ForSomeoneLineFlagFields,
  type ProcurementFlagDefinition,
  type ProcurementRequestFlag,
} from "@/lib/orders/procurement-request-flag";
import { PROCUREMENT_REQUEST_FLAG_COPY } from "@/lib/orders/procurement-request-flag-copy";

export type ProcurementRequestFlagEditResult = {
  orderIds: string[];
  flag: ProcurementRequestFlag | null;
  note: string | null;
};

type ProcurementRequestFlagEditModalProps = {
  open: boolean;
  lines: ForSomeoneLineFlagFields[];
  definitions: ProcurementFlagDefinition[];
  /** Gdy jedna linia — bez pickera; wiele — checkboxy. */
  initialOrderIds?: string[];
  initialFlag?: ProcurementRequestFlag | null;
  initialNote?: string | null;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: (result: ProcurementRequestFlagEditResult) => void;
};

function lineLabel(line: ForSomeoneLineFlagFields): string {
  const sym = line.symbol?.trim() && line.symbol !== "-" ? line.symbol : null;
  const prod = line.products?.trim() || "Pozycja";
  return sym ? `${sym} — ${prod}` : prod;
}

function ProcurementRequestFlagEditModalForm({
  lines,
  definitions,
  initialOrderIds,
  initialFlag,
  initialNote,
  pending,
  onCancel,
  onConfirm,
}: Omit<ProcurementRequestFlagEditModalProps, "open">) {
  const multi = lines.length > 1;
  const allIds = useMemo(() => lines.map((l) => l.id), [lines]);
  const activeDefs = useMemo(
    () =>
      [...definitions]
        .filter((d) => d.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [definitions]
  );
  const initialDef = findFlagDefinition(definitions, initialFlag);
  const initialIsInactive = Boolean(
    initialFlag && initialDef && !initialDef.isActive
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (initialOrderIds?.length) return new Set(initialOrderIds);
    if (!multi) return new Set(allIds);
    return new Set(allIds);
  });
  // Zachowaj nieaktywną bieżącą (update notatki); aktywne też.
  const [flag, setFlag] = useState<ProcurementRequestFlag | null>(
    initialFlag ?? null
  );
  const [note, setNote] = useState(initialNote?.trim() ?? "");
  const [applyAllConfirmed, setApplyAllConfirmed] = useState(false);

  const selectedCount = selectedIds.size;
  const selectingAll = multi && selectedCount === lines.length;
  const canSave =
    selectedCount > 0 && (!selectingAll || applyAllConfirmed || !multi);

  const selectedDef = findFlagDefinition(definitions, flag);
  const selectedIsInactive = Boolean(flag && selectedDef && !selectedDef.isActive);
  const selectedIsOrphan = Boolean(flag && !selectedDef);
  const keepingInactive =
    selectedIsInactive &&
    initialFlag != null &&
    flag?.toLowerCase() === initialFlag.toLowerCase();
  const canPersistFlag =
    flag != null &&
    !selectedIsOrphan &&
    (!selectedIsInactive || keepingInactive);

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = (clear: boolean) => {
    if (selectedCount === 0) return;
    if (selectingAll && multi && !applyAllConfirmed) return;
    if (!clear && flag == null) return;
    if (!clear && !canPersistFlag) return;
    onConfirm({
      orderIds: [...selectedIds],
      flag: clear ? null : flag,
      note: clear ? null : note.trim() || null,
    });
  };

  return (
    <ModalShell
      open
      onClose={onCancel}
      title={
        multi
          ? PROCUREMENT_REQUEST_FLAG_COPY.modalTitleMulti
          : PROCUREMENT_REQUEST_FLAG_COPY.modalTitle
      }
      titleId="procurement-request-flag-edit-title"
      size="sm"
      tier="raised"
      disableBackdropClose={pending}
      loadingMessage={pending ? "Zapisywanie…" : null}
      bodyClassName="px-5 py-4 sm:px-6"
      footer={
        <div className="flex w-full flex-col gap-2">
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="ghost"
              className="min-h-11 w-full sm:w-auto"
              onClick={() => handleConfirm(true)}
              disabled={pending || selectedCount === 0 || (selectingAll && multi && !applyAllConfirmed)}
            >
              {PROCUREMENT_REQUEST_FLAG_COPY.clear}
            </Button>
            <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
              <Button
                variant="ghost"
                className="min-h-11 w-full sm:w-auto"
                onClick={onCancel}
                disabled={pending}
              >
                {PROCUREMENT_REQUEST_FLAG_COPY.cancel}
              </Button>
              <Button
                className="min-h-11 w-full sm:w-auto"
                onClick={() => handleConfirm(false)}
                disabled={
                  pending ||
                  !canSave ||
                  flag == null ||
                  !canPersistFlag
                }
              >
                {PROCUREMENT_REQUEST_FLAG_COPY.save}
              </Button>
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-slate-600">
          {PROCUREMENT_REQUEST_FLAG_COPY.modalHint}
        </p>

        {multi ? (
          <fieldset className="space-y-2">
            <legend className="text-[11px] font-medium text-slate-600">
              {PROCUREMENT_REQUEST_FLAG_COPY.selectLines}
            </legend>
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200/80 p-2">
              {lines.map((line) => {
                const checked = selectedIds.has(line.id);
                const currentDef = findFlagDefinition(
                  definitions,
                  line.procurementFlag
                );
                return (
                  <li key={line.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs text-slate-800 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={checked}
                        disabled={pending}
                        onChange={() => toggleId(line.id)}
                      />
                      <span className="min-w-0 leading-snug">
                        <span className="font-medium">{lineLabel(line)}</span>
                        {line.procurementFlag ? (
                          <span className="mt-0.5 block text-[10px] text-slate-500">
                            Teraz:{" "}
                            {currentDef?.label ?? line.procurementFlag}
                            {currentDef && !currentDef.isActive
                              ? " (nieaktywna)"
                              : ""}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {selectingAll ? (
              <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={applyAllConfirmed}
                  disabled={pending}
                  onChange={(e) => setApplyAllConfirmed(e.target.checked)}
                />
                <span>{PROCUREMENT_REQUEST_FLAG_COPY.applyAllConfirm}</span>
              </label>
            ) : null}
          </fieldset>
        ) : null}

        <fieldset>
          <legend className="mb-1.5 text-[11px] font-medium text-slate-600">
            Flaga
          </legend>
          {selectedIsOrphan ? (
            <p className="mb-2 text-xs text-amber-800">
              Nieznana flaga — wybierz aktywną albo usuń flagę.
            </p>
          ) : null}
          {initialIsInactive && initialDef && keepingInactive ? (
            <p className="mb-2 text-xs text-amber-800">
              {PROCUREMENT_REQUEST_FLAG_COPY.manageInactiveCurrent}
            </p>
          ) : null}
          {keepingInactive && initialDef ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              <span
                className={cn(
                  panelChoiceChipClass,
                  "inline-flex items-center gap-1.5 text-[11px] opacity-80",
                  procurementFlagModalChipSelectedClass(initialDef.color)
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    procurementFlagDotClass(initialDef.color)
                  )}
                  aria-hidden
                />
                {initialDef.label} (nieaktywna)
              </span>
            </div>
          ) : null}
          {activeDefs.length === 0 && !keepingInactive ? (
            <p className="text-xs text-slate-500">
              Brak aktywnych flag — dodaj je w „Zarządzaj”.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {activeDefs.map((f) => {
                const active = flag?.toLowerCase() === f.id.toLowerCase();
                return (
                  <button
                    key={f.id}
                    type="button"
                    disabled={pending}
                    onClick={() => setFlag(f.id)}
                    className={cn(
                      panelChoiceChipClass,
                      "inline-flex items-center gap-1.5 text-[11px]",
                      active
                        ? procurementFlagModalChipSelectedClass(f.color)
                        : panelChoiceChipIdleClass
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        procurementFlagDotClass(f.color)
                      )}
                      aria-hidden
                    />
                    {f.label}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>

        <label className="block">
          <span className="flex items-baseline justify-between gap-2 text-[11px] font-medium text-slate-600">
            <span>{PROCUREMENT_REQUEST_FLAG_COPY.noteLabel}</span>
            <span
              className={cn(
                "tabular-nums font-normal",
                note.length > MAX_PROCUREMENT_FLAG_NOTE_LEN * 0.9
                  ? "text-amber-700"
                  : "text-slate-400"
              )}
            >
              {note.length}/{MAX_PROCUREMENT_FLAG_NOTE_LEN}
            </span>
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            maxLength={MAX_PROCUREMENT_FLAG_NOTE_LEN}
            disabled={pending || flag == null}
            placeholder={PROCUREMENT_REQUEST_FLAG_COPY.notePlaceholder}
            className={cn(
              "mt-1 min-h-[5.5rem] w-full resize-y rounded-md border border-slate-200 px-2.5 py-2 text-xs leading-relaxed text-slate-800 placeholder:text-slate-400",
              controlFocusClass
            )}
          />
          <p className={cn(panelTypography.caption, "mt-1")}>
            Opis widać pod flagą w panelu — krótkie zdanie czyta się najlepiej.
          </p>
        </label>
      </div>
    </ModalShell>
  );
}

export function ProcurementRequestFlagEditModal({
  open,
  lines,
  definitions,
  initialOrderIds,
  initialFlag,
  initialNote,
  ...props
}: ProcurementRequestFlagEditModalProps) {
  if (!open || !lines.length) return null;
  const key = [
    lines.map((l) => l.id).join(","),
    initialOrderIds?.join(",") ?? "",
    initialFlag ?? "",
    initialNote ?? "",
    definitions.map((d) => `${d.id}:${d.isActive}`).join(","),
  ].join("|");
  return (
    <ProcurementRequestFlagEditModalForm
      key={key}
      lines={lines}
      definitions={definitions}
      initialOrderIds={initialOrderIds}
      initialFlag={initialFlag}
      initialNote={initialNote}
      {...props}
    />
  );
}
