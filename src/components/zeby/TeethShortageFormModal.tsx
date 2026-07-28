"use client";

import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { TeethMouldShapePicker } from "@/components/teeth/TeethMouldShapePicker";
import { cn } from "@/lib/cn";
import {
  TEETH_CHIP_OTHER,
  TEETH_KIND_LABELS,
  TEETH_MANUFACTURERS,
  hasMouldsForKind,
  lineOptionalMould,
  manufacturerForProductLine,
  mouldRequiredForKind,
  parseTeethProductLine,
  teethColorsFor,
  teethProductLineLabel,
  teethLinesForManufacturer,
  type TeethKind,
  type TeethProductLine,
} from "@/lib/teeth/teeth-catalog";
import { catalogLineSupportsDualKind } from "@/lib/teeth/teeth-lines-data";
import { resolveSupplierForTeethManufacturer } from "@/lib/orders/teeth-ocr-prosba-prefill";
import {
  teethShortageAvailabilityBadgeLabel,
} from "@/lib/teeth/teeth-shortage-copy";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
} from "@/lib/ui/ontime-theme";
import { warsawNowParts } from "@/lib/time/warsaw";
import type { TeethSupplierShortageWithSupplier } from "@/types/database";

export type TeethShortageFormState = {
  id: string | null;
  supplierId: string;
  productLine: TeethProductLine | "";
  color: string;
  mould: string;
  kind: TeethKind | "";
  availableFrom: string;
  dateUndetermined: boolean;
  note: string;
};

export const EMPTY_TEETH_SHORTAGE_FORM: TeethShortageFormState = {
  id: null,
  supplierId: "",
  productLine: "",
  color: "",
  mould: "",
  kind: "",
  availableFrom: "",
  dateUndetermined: true,
  note: "",
};

export function teethShortageRowToForm(
  row: TeethSupplierShortageWithSupplier,
): TeethShortageFormState {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    productLine: parseTeethProductLine(row.product_line) ?? "",
    color: row.color,
    mould: row.mould,
    kind: row.kind ?? "",
    availableFrom: row.available_from ?? "",
    dateUndetermined: row.available_from == null,
    note: row.note,
  };
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-md border border-slate-200/80 bg-slate-50/40 p-3 sm:p-3.5">
      <header className="space-y-0.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h3>
        {hint ? <p className="text-[11px] leading-snug text-slate-500">{hint}</p> : null}
      </header>
      {children}
    </section>
  );
}

function ChoiceChip({
  label,
  active,
  disabled,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        panelChoiceChipClass,
        "inline-flex shrink-0 items-center px-2.5 py-1.5 text-xs",
        active ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass,
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      {label}
    </button>
  );
}

function RequiredMark() {
  return <span className="ml-0.5 text-rose-500">*</span>;
}

function clientValidate(
  form: TeethShortageFormState,
  suppliers: { id: string; name: string }[],
): string | null {
  if (!form.productLine) return "Wybierz linię produktu.";
  const supplierId =
    form.supplierId.trim() ||
    resolveSupplierForTeethManufacturer(
      manufacturerForProductLine(form.productLine),
      suppliers,
    );
  if (!supplierId) {
    return "Nie znaleziono dostawcy dla tej marki w kartach dostawców — dopisz lab o nazwie producenta.";
  }
  if (!form.color.trim()) return "Wybierz kolor z katalogu.";
  if (form.color.trim() === TEETH_CHIP_OTHER) return "Wybierz kolor z katalogu (bez „inny”).";

  const catalog = { productLine: form.productLine };
  const kind = form.kind || null;

  if (kind && mouldRequiredForKind(catalog, kind) && !form.mould.trim()) {
    return "Wybierz fason dla tej linii.";
  }
  if (form.mould.trim() === TEETH_CHIP_OTHER) {
    return "Wybierz fason z katalogu (bez „inny”).";
  }
  if (!form.dateUndetermined && !form.availableFrom.trim()) {
    return "Podaj datę dostępności albo wybierz „Nieustalona”.";
  }
  if (
    !form.dateUndetermined &&
    form.availableFrom &&
    !/^\d{4}-\d{2}-\d{2}$/.test(form.availableFrom)
  ) {
    return "Nieprawidłowa data dostępności.";
  }
  return null;
}

function saveBlockReason(
  form: TeethShortageFormState,
  suppliers: { id: string; name: string }[],
): string | null {
  if (!form.productLine) return "Wybierz linię produktu";
  const supplierId =
    form.supplierId.trim() ||
    resolveSupplierForTeethManufacturer(
      manufacturerForProductLine(form.productLine),
      suppliers,
    );
  if (!supplierId) return "Brak dopasowanego dostawcy dla tej marki";
  if (!form.color.trim()) return "Wybierz kolor";
  const catalog = form.productLine ? { productLine: form.productLine } : null;
  const kind = (form.kind || null) as TeethKind | null;
  if (catalog && kind && mouldRequiredForKind(catalog, kind) && !form.mould.trim()) {
    return "Wybierz fason";
  }
  if (!form.dateUndetermined && !form.availableFrom.trim()) {
    return "Podaj datę lub wybierz „Nieustalona”";
  }
  return null;
}

export function TeethShortageFormModal({
  open,
  form,
  onChange,
  onClose,
  onSave,
  suppliers,
  pending = false,
  serverError = null,
}: {
  open: boolean;
  form: TeethShortageFormState;
  onChange: (next: TeethShortageFormState | ((prev: TeethShortageFormState) => TeethShortageFormState)) => void;
  onClose: () => void;
  onSave: (payload: TeethShortageFormState) => void;
  suppliers: { id: string; name: string }[];
  pending?: boolean;
  serverError?: string | null;
}) {
  const [attempted, setAttempted] = useState(false);
  const todayKey = warsawNowParts().dateKey;

  const catalog = useMemo(
    () => (form.productLine ? { productLine: form.productLine } : null),
    [form.productLine],
  );
  const colors = catalog ? teethColorsFor(catalog) : [];

  const dualKind = form.productLine
    ? catalogLineSupportsDualKind(form.productLine)
    : false;
  const hasAnteriorMoulds = catalog ? hasMouldsForKind(catalog, "anterior") : false;
  const hasPosteriorMoulds = catalog ? hasMouldsForKind(catalog, "posterior") : false;
  const hasAnyMoulds = hasAnteriorMoulds || hasPosteriorMoulds;
  const optionalMould = form.productLine ? lineOptionalMould(form.productLine) : false;

  /** Pokaż typ gdy linia rozróżnia przody/boki albo ma fasony zależne od typu. */
  const showKindPicker = dualKind || (hasAnteriorMoulds && hasPosteriorMoulds);
  /** Jedna strona fasonów — wymuś kind bez pickera. */
  const lockedKind: TeethKind | null =
    !showKindPicker && hasAnteriorMoulds && !hasPosteriorMoulds
      ? "anterior"
      : !showKindPicker && hasPosteriorMoulds && !hasAnteriorMoulds
        ? "posterior"
        : null;

  const effectiveKind: TeethKind | null =
    (form.kind || lockedKind || null) as TeethKind | null;

  const showMouldPicker =
    !!catalog &&
    !!effectiveKind &&
    hasMouldsForKind(catalog, effectiveKind) &&
    !optionalMould;

  const showOptionalMouldInput =
    !!catalog && !!effectiveKind && optionalMould;

  const resolvedSupplierId = useMemo(() => {
    if (form.supplierId.trim()) return form.supplierId.trim();
    if (!form.productLine) return "";
    return resolveSupplierForTeethManufacturer(
      manufacturerForProductLine(form.productLine),
      suppliers,
    );
  }, [form.supplierId, form.productLine, suppliers]);

  const blockReason = saveBlockReason(
    {
      ...form,
      supplierId: resolvedSupplierId,
      kind: (form.kind || lockedKind || "") as TeethKind | "",
    },
    suppliers,
  );
  const localError = attempted
    ? clientValidate(
        {
          ...form,
          supplierId: resolvedSupplierId,
          kind: (form.kind || lockedKind || "") as TeethKind | "",
        },
        suppliers,
      )
    : null;
  const errorMsg = serverError || localError;

  const supplierName =
    suppliers.find((s) => s.id === resolvedSupplierId)?.name?.trim() || null;
  const lineLabel = form.productLine
    ? teethProductLineLabel(form.productLine)
    : null;

  const previewParts: string[] = [];
  if (lineLabel) previewParts.push(lineLabel);
  if (form.color.trim()) previewParts.push(form.color.trim());
  if (form.mould.trim()) previewParts.push(form.mould.trim());
  if (effectiveKind) previewParts.push(TEETH_KIND_LABELS[effectiveKind]);
  else if (showKindPicker && form.kind === "") previewParts.push("oba typy");

  const dateBadge = form.dateUndetermined
    ? "Nieustalona"
    : form.availableFrom
      ? teethShortageAvailabilityBadgeLabel(form.availableFrom, todayKey)
      : "—";

  function patch(p: Partial<TeethShortageFormState>) {
    onChange((prev) => ({ ...prev, ...p }));
  }

  function handleProductLine(next: TeethProductLine | "") {
    const supplierId = next
      ? resolveSupplierForTeethManufacturer(
          manufacturerForProductLine(next),
          suppliers,
        )
      : "";
    patch({
      productLine: next,
      supplierId,
      color: "",
      mould: "",
      kind: "",
    });
  }

  function handleKind(next: TeethKind | "") {
    patch({ kind: next, mould: "" });
  }

  function handleSave() {
    const kindToSave = (form.kind || lockedKind || "") as TeethKind | "";
    const supplierId =
      resolvedSupplierId ||
      (form.productLine
        ? resolveSupplierForTeethManufacturer(
            manufacturerForProductLine(form.productLine),
            suppliers,
          )
        : "");
    const payload: TeethShortageFormState = {
      ...form,
      kind: kindToSave,
      supplierId,
    };
    setAttempted(true);
    const err = clientValidate(payload, suppliers);
    if (err) {
      if (kindToSave && kindToSave !== form.kind) patch({ kind: kindToSave });
      if (supplierId && supplierId !== form.supplierId) patch({ supplierId });
      return;
    }
    if (kindToSave !== form.kind || supplierId !== form.supplierId) {
      patch({ kind: kindToSave, supplierId });
    }
    onSave(payload);
  }

  function resetAndClose() {
    if (pending) return;
    setAttempted(false);
    onClose();
  }

  return (
    <ModalShell
      open={open}
      onClose={resetAndClose}
      title={form.id ? "Edytuj brak" : "Dodaj brak"}
      titleHint="Wpis dotyczy konkretnego wariantu (linia + kolor + fason). Handlowiec zobaczy ostrzeżenie przy prośbie — bez blokady wysyłki."
      description="Wybierz linię katalogową i wariant. Dostawca dopasuje się automatycznie do marki."
      size="lg"
      loadingMessage={pending ? "Zapisywanie…" : null}
      bodyClassName="space-y-3 px-5 py-4 sm:px-6"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-h-[1.25rem] text-[11px] text-slate-500">
            {blockReason && attempted ? (
              <span className="text-amber-800">{blockReason}</span>
            ) : (
              <span>Pola oznaczone * są wymagane.</span>
            )}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={pending} onClick={resetAndClose}>
              Anuluj
            </Button>
            <Button
              disabled={pending}
              title={blockReason ?? undefined}
              onClick={handleSave}
            >
              {form.id ? "Zapisz zmiany" : "Dodaj brak"}
            </Button>
          </div>
        </div>
      }
    >
      {errorMsg ? (
        <Alert tone="error" title="Nie zapisano">
          {errorMsg}
        </Alert>
      ) : null}

      <Section
        title="Linia produktu"
        hint="Marka w liście odpowiada dostawcy — lab dopasuje się sam."
      >
        <Field
          label={
            <>
              Linia
              <RequiredMark />
            </>
          }
          state={attempted && !form.productLine ? "error" : "default"}
          error={attempted && !form.productLine ? "Wybierz linię" : undefined}
        >
          <Select
            value={form.productLine}
            state={attempted && !form.productLine ? "error" : "default"}
            disabled={pending}
            onChange={(e) => {
              const productLine =
                (parseTeethProductLine(e.target.value) as TeethProductLine | null) ??
                "";
              handleProductLine(productLine);
            }}
          >
            <option value="">Wybierz linię…</option>
            {TEETH_MANUFACTURERS.map((mfr) => (
              <optgroup key={mfr.id} label={mfr.label}>
                {teethLinesForManufacturer(mfr.id).map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        {form.productLine ? (
          <p
            className={cn(
              "rounded-md px-2.5 py-1.5 text-[11px] leading-snug",
              supplierName
                ? "border border-slate-200/80 bg-white text-slate-600"
                : "border border-amber-200/80 bg-amber-50/50 text-amber-900",
            )}
          >
            {supplierName ? (
              <>
                Dostawca: <span className="font-medium text-slate-800">{supplierName}</span>
              </>
            ) : (
              "Nie znaleziono labu o nazwie tej marki w kartach dostawców."
            )}
          </p>
        ) : null}
      </Section>

      {catalog ? (
        <Section
          title="Wariant"
          hint="Kolor i fason jak na kartce klienta — bez opcji „inny”."
        >
          {showKindPicker ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold tracking-wide text-slate-600">
                Typ
                {dualKind && hasAnyMoulds ? (
                  <span className="ml-1 font-normal text-slate-400">
                    — „Bez rozróżnienia” = brak dla obu typów (bez fasonu)
                  </span>
                ) : null}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <ChoiceChip
                  label="Bez rozróżnienia"
                  active={form.kind === ""}
                  disabled={pending}
                  onClick={() => handleKind("")}
                />
                {(Object.keys(TEETH_KIND_LABELS) as TeethKind[]).map((k) => (
                  <ChoiceChip
                    key={k}
                    label={TEETH_KIND_LABELS[k]}
                    active={form.kind === k}
                    disabled={pending}
                    onClick={() => handleKind(k)}
                  />
                ))}
              </div>
            </div>
          ) : lockedKind ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold tracking-wide text-slate-600">Typ</p>
              <span
                className={cn(
                  panelChoiceChipClass,
                  "px-2.5 py-1.5 text-xs",
                  panelChoiceChipSelectedClass,
                )}
              >
                {TEETH_KIND_LABELS[lockedKind]}
              </span>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <p className="text-xs font-semibold tracking-wide text-slate-600">
              Kolor
              <RequiredMark />
            </p>
            <div
              className={cn(
                "flex flex-wrap gap-1 rounded-md border border-slate-200/70 bg-white p-2",
                colors.length > 24 && "max-h-36 overflow-y-auto",
              )}
            >
              {colors.map((c) => (
                <ChoiceChip
                  key={c}
                  label={c}
                  active={form.color === c}
                  disabled={pending}
                  className="px-2 py-1 text-[11px]"
                  onClick={() => patch({ color: c })}
                />
              ))}
              {colors.length === 0 ? (
                <p className="px-1 py-0.5 text-[11px] text-slate-500">
                  Ta linia nie ma zdefiniowanej palety kolorów w katalogu.
                </p>
              ) : null}
            </div>
            {attempted && !form.color.trim() ? (
              <p className="text-xs text-red-700">Wybierz kolor</p>
            ) : null}
          </div>

          {showMouldPicker && effectiveKind && form.productLine ? (
            <div
              className={cn(
                "rounded-md border border-slate-200/70 bg-white p-2.5",
                attempted &&
                  mouldRequiredForKind(catalog, effectiveKind) &&
                  !form.mould.trim() &&
                  "border-red-300 bg-red-50/40",
              )}
            >
              <TeethMouldShapePicker
                key={`${form.productLine}-${effectiveKind}`}
                productLine={form.productLine}
                kind={effectiveKind}
                mould={form.mould || null}
                onMouldChange={(m) => patch({ mould: (m ?? "").trim() })}
                disabled={pending}
                compact
                allowOther={false}
                required={mouldRequiredForKind(catalog, effectiveKind)}
              />
            </div>
          ) : null}

          {showOptionalMouldInput ? (
            <Field
              label="Fason (opcjonalnie)"
              hint="Ta linia nie wymaga fasonu — możesz zostawić puste."
            >
              <Input
                value={form.mould}
                disabled={pending}
                onChange={(e) => patch({ mould: e.target.value })}
                placeholder="np. kod fasonu"
              />
            </Field>
          ) : null}

          {!showMouldPicker && !showOptionalMouldInput && showKindPicker && form.kind === "" ? (
            <p className="rounded-md border border-dashed border-slate-200 bg-white/70 px-2.5 py-2 text-[11px] leading-snug text-slate-500">
              Bez rozróżnienia typu — wpis obejmuje przednie i boczne tej samej linii/koloru.
              Aby wskazać konkretny fason, wybierz typ.
            </p>
          ) : null}
        </Section>
      ) : (
        <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-3 py-4 text-center text-xs text-slate-500">
          Wybierz linię produktu, aby wskazać kolor i fason.
        </div>
      )}

      {/* Podgląd wariantu */}
      <div
        className={cn(
          "flex flex-wrap items-start gap-2 rounded-md border px-3 py-2.5",
          previewParts.length > 0
            ? "border-amber-200/90 bg-amber-50/50"
            : "border-slate-200/80 bg-slate-50/60",
        )}
        aria-live="polite"
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/70">
            Podgląd wpisu
          </p>
          <p
            className={cn(
              "text-sm font-medium leading-snug",
              previewParts.length > 0 ? "text-amber-950" : "text-slate-400",
            )}
          >
            {previewParts.length > 0 ? previewParts.join(" · ") : "Uzupełnij pola powyżej"}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200/80">
          {dateBadge}
        </span>
      </div>

      <Section
        title="Dostępność"
        hint="Null w bazie = termin nieustalony — handlowiec zobaczy osobne copy, nie pustą datę."
      >
        <div className="flex flex-wrap gap-1.5">
          <ChoiceChip
            label="Nieustalona"
            active={form.dateUndetermined}
            disabled={pending}
            onClick={() =>
              patch({ dateUndetermined: true, availableFrom: "" })
            }
          />
          <ChoiceChip
            label="Podaj datę"
            active={!form.dateUndetermined}
            disabled={pending}
            onClick={() => patch({ dateUndetermined: false })}
          />
        </div>

        {form.dateUndetermined ? (
          <p className="rounded-md border border-amber-200/70 bg-amber-50/40 px-2.5 py-2 text-[11px] leading-snug text-amber-900/90">
            Ostrzeżenie przy prośbie: „termin dostępności nieustalony”.
            Datę możesz uzupełnić później bez zmiany wariantu.
          </p>
        ) : (
          <Field
            label={
              <>
                Dostępne od
                <RequiredMark />
              </>
            }
            state={
              attempted && !form.availableFrom.trim() ? "error" : "default"
            }
            error={
              attempted && !form.availableFrom.trim()
                ? "Podaj datę"
                : undefined
            }
          >
            <Input
              type="date"
              value={form.availableFrom}
              disabled={pending}
              state={
                attempted && !form.availableFrom.trim() ? "error" : "default"
              }
              onChange={(e) => patch({ availableFrom: e.target.value })}
            />
          </Field>
        )}
      </Section>

      <Section title="Notatka" hint="Widoczna dla handlowca przy ostrzeżeniu (opcjonalnie).">
        <Field label="Uwaga dla handlowca">
          <Input
            value={form.note}
            disabled={pending}
            onChange={(e) => patch({ note: e.target.value })}
            placeholder="np. dostawca czeka na produkcję"
            maxLength={500}
          />
        </Field>
      </Section>
    </ModalShell>
  );
}
