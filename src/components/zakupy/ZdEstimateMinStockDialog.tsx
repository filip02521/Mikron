"use client";

import { useId, useState, useTransition, type KeyboardEvent } from "react";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import { IconPackageCheck } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";
import { panelTypography } from "@/lib/ui/ontime-theme";

const MIN_STOCK_MAX = 1_000_000;

function assertMinStockSzt(raw: string):
  | { ok: true; value: number }
  | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: false, message: ZD_ESTIMATE_UI.minStockValueRequiredError };
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    return { ok: false, message: ZD_ESTIMATE_UI.minStockValueRequiredError };
  }
  if (n > MIN_STOCK_MAX) {
    return { ok: false, message: ZD_ESTIMATE_UI.minStockValueRequiredError };
  }
  return { ok: true, value: Math.trunc(n) };
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "emerald" | "amber" | "indigo";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "indigo"
          ? "text-indigo-700"
          : "text-slate-900";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span className={cn("text-sm font-semibold tabular-nums", toneClass)}>
        {value}
      </span>
    </div>
  );
}

function MinStockDialogForm({
  line,
  existingMinSzt,
  pending,
  onCancel,
  onSave,
  onClear,
}: {
  line: ManualZdEstimateLine;
  existingMinSzt: number;
  pending: boolean;
  onCancel: () => void;
  onSave: (value: number, note: string) => void;
  onClear: () => void;
}) {
  const valueId = useId();
  const noteId = useId();
  const [draftValue, setDraftValue] = useState(
    String(existingMinSzt || "")
  );
  const [draftNote, setDraftNote] = useState("");
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [, start] = useTransition();

  const check = assertMinStockSzt(draftValue);
  const showErr = draftValue.trim() !== "" && !check.ok;

  // Oblicz podgląd efektu minimum
  const draftMin = check.ok ? check.value : existingMinSzt;
  const celBazowy = Math.abs(line.salesTrackDelta) > 1e-9
    ? line.celZapasuTracked
    : line.celZapasu;
  const celZMin = Math.max(celBazowy, draftMin);
  const doZdBezMin = line.doZamowieniaReczne;
  const doZdZMin = Math.max(
    0,
    Math.ceil(celZMin - line.dostepne - line.otwarteZd)
  );
  const roznica = doZdZMin - doZdBezMin;
  const minAktywny = draftMin > celBazowy;

  const handleSave = () => {
    if (!check.ok) return;
    start(() => onSave(check.value, draftNote.trim()));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <>
    <ModalShell
      open
      onClose={onCancel}
      title={ZD_ESTIMATE_UI.minStockModalTitle}
      titleHint={ZD_ESTIMATE_UI.minStockModalHint}
      size="md"
      bodyClassName="space-y-4 px-5 py-5 sm:px-6"
      loadingMessage={pending ? "Zapisuję…" : null}
      disableBackdropClose={pending}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {existingMinSzt > 0 ? (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => setConfirmClearOpen(true)}
                title={ZD_ESTIMATE_UI.minStockClearCta}
                className="border-red-200 text-red-700 hover:bg-red-50"
              >
                {ZD_ESTIMATE_UI.minStockClearCta}
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2 self-end sm:self-auto">
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={onCancel}
            >
              Anuluj
            </Button>
            <Button
              type="button"
              disabled={pending || !check.ok}
              onClick={handleSave}
            >
              {pending ? (
                <span className="inline-flex items-center gap-1.5">
                  <Spinner className="size-3.5" /> Zapis…
                </span>
              ) : (
                "Zapisz"
              )}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Produkt — header */}
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 px-4 py-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="font-semibold tabular-nums tracking-tight text-slate-900">
              {line.tw_Symbol}
            </p>
            {existingMinSzt > 0 ? (
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-900 ring-1 ring-emerald-100">
                min {existingMinSzt} szt
              </span>
            ) : (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                brak minimum
              </span>
            )}
            {line.grt_Nazwa ? (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {line.grt_Nazwa}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-snug text-slate-600">
            {line.tw_Nazwa}
          </p>
        </div>

        {/* Stats — obecny stan magazynu */}
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200/70 bg-white px-4 py-2.5">
          <Stat label="Dostępne" value={String(line.dostepne)} />
          <Stat label="Otwarte ZD" value={String(line.otwarteZd)} />
          <Stat
            label="Cel (sprzedaż)"
            value={String(Math.round(celBazowy))}
          />
        </div>

        {/* Form — minimum */}
        <div className="grid gap-2.5 sm:grid-cols-[8rem_1fr]">
          <label
            htmlFor={valueId}
            className="block text-xs font-medium text-slate-600"
          >
            {ZD_ESTIMATE_UI.minStockValueLabel}
            <Input
              id={valueId}
              type="number"
              min={0}
              max={MIN_STOCK_MAX}
              step={1}
              className="mt-1 tabular-nums"
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              aria-invalid={showErr || undefined}
              autoFocus
              onKeyDown={handleKeyDown}
              placeholder="np. 10"
            />
          </label>
          <label
            htmlFor={noteId}
            className="block text-xs font-medium text-slate-600"
          >
            {ZD_ESTIMATE_UI.minStockNoteLabel}
            <Input
              id={noteId}
              className="mt-1"
              value={draftNote}
              maxLength={500}
              onChange={(e) => setDraftNote(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Dlaczego to minimum…"
            />
          </label>
        </div>

        {/* Podgląd efektu */}
        {check.ok && draftMin > 0 ? (
          <div
            className={cn(
              "rounded-lg border px-4 py-3",
              minAktywny
                ? "border-indigo-200/80 bg-indigo-50/40"
                : "border-slate-200/70 bg-slate-50/50"
            )}
          >
            <div className="flex items-center gap-2">
              <IconPackageCheck
                size={14}
                strokeWidth={2.25}
                className={cn(
                  "shrink-0",
                  minAktywny ? "text-indigo-600" : "text-slate-400"
                )}
                aria-hidden
              />
              <p className="text-xs font-semibold text-slate-700">
                Podgląd efektu
              </p>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Stat
                label="Cel z min."
                value={String(Math.round(celZMin))}
                tone={minAktywny ? "indigo" : "default"}
              />
              <Stat
                label="Do ZD teraz"
                value={String(doZdBezMin)}
              />
              <Stat
                label="Do ZD z min."
                value={String(doZdZMin)}
                tone={minAktywny ? "emerald" : "default"}
              />
            </div>
            {minAktywny ? (
              <p className="mt-2 text-[11px] leading-snug text-indigo-700/80">
                {roznica > 0
                  ? `Minimum podbija cel o ${Math.round(celZMin - celBazowy)} szt — zamówienie rośnie o ${roznica} szt.`
                  : `Minimum podbija cel, ale stan/ZD już pokrywają zapotrzebowanie.`}
              </p>
            ) : (
              <p className="mt-2 text-[11px] leading-snug text-slate-500">
                Cel ze sprzedaży ({Math.round(celBazowy)} szt) jest wyższy niż
                minimum ({draftMin} szt) — minimum nie zmienia zamówienia.
              </p>
            )}
          </div>
        ) : showErr ? (
          <p className={cn(panelTypography.caption, "text-amber-800")}>
            {check.ok ? null : check.message}
          </p>
        ) : (
          <p className={cn(panelTypography.caption)}>
            {ZD_ESTIMATE_UI.minStockValueHint}
          </p>
        )}
      </div>
    </ModalShell>
      <ConfirmDialog
        open={confirmClearOpen}
        title="Wyczyścić minimum stanów?"
        message={`Minimum stanów dla ${line.tw_Symbol} zostanie usunięte. Przy kolejnym szacunku produkt będzie zamówiony tylko ze względu na sprzedaż i zapas.`}
        confirmLabel="Wyczyść"
        cancelLabel="Anuluj"
        danger
        onConfirm={() => {
          setConfirmClearOpen(false);
          onClear();
        }}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </>
  );
}

/**
 * Inline dialog: ustaw minimum stanów dla jednego produktu z wiersza listy.
 */
export function ZdEstimateMinStockDialog({
  open,
  line,
  existingMinSzt,
  pending,
  onCancel,
  onSave,
  onClear,
}: {
  open: boolean;
  line: ManualZdEstimateLine | null;
  existingMinSzt: number;
  pending: boolean;
  onCancel: () => void;
  onSave: (value: number, note: string) => void;
  onClear: () => void;
}) {
  if (!open || !line) return null;
  return (
    <MinStockDialogForm
      key={`${line.tw_Id}-${existingMinSzt}`}
      line={line}
      existingMinSzt={existingMinSzt}
      pending={pending}
      onCancel={onCancel}
      onSave={onSave}
      onClear={onClear}
    />
  );
}
