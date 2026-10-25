"use client";

import { useMemo, useState, useTransition } from "react";
import { userFacingErrorTextFromMessage } from "@/lib/ui/user-facing-error";
import {
  actionSetTeethShortageActive,
  actionUpsertTeethShortage,
} from "@/app/actions/teeth-shortages";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { fieldControlClass } from "@/components/ui/Field";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { IconPlusCircle, IconSearch, IconToothShortage } from "@/components/icons/StrokeIcons";
import { TeethPanelWorkspaceCard } from "@/components/zeby/TeethPanelWorkspaceCard";
import { TeethPanelTabPanel } from "@/components/zeby/TeethPanelSection";
import {
  EMPTY_TEETH_SHORTAGE_FORM,
  TeethShortageFormModal,
  teethShortageRowToForm,
  type TeethShortageFormState,
} from "@/components/zeby/TeethShortageFormModal";
import {
  TEETH_BRAKI_ADD_COPY,
  TEETH_BRAKI_PAGE_HINT,
  TEETH_BRAKI_PAGE_TITLE,
} from "@/components/zeby/teeth-panel-copy";
import { cn } from "@/lib/cn";
import {
  TEETH_KIND_LABELS,
  parseTeethProductLine,
  teethProductLineLabel,
} from "@/lib/teeth/teeth-catalog";
import {
  teethShortageAvailabilityBadgeLabel,
  teethShortageAvailabilityBadgeClass,
  classifyTeethShortageAvailability,
} from "@/lib/teeth/teeth-shortage-copy";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
} from "@/lib/ui/ontime-theme";
import { toastError, toastSuccess, type ToastNotice } from "@/lib/ui/notice-copy";
import { warsawNowParts } from "@/lib/time/warsaw";
import type { TeethSupplierShortageWithSupplier } from "@/types/database";
import { matchesSearchWords } from "@/lib/search/keywords";
import { polishPluralWord } from "@/lib/email/polish-plural";

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        panelChoiceChipClass,
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-xs sm:min-h-10",
        active ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass,
      )}
    >
      {label}
    </button>
  );
}

export function TeethShortagesClient({
  initialShortages,
  suppliers,
  loadError = null,
}: {
  initialShortages: TeethSupplierShortageWithSupplier[];
  suppliers: { id: string; name: string }[];
  loadError?: string | null;
}) {
  const [rows, setRows] = useState(initialShortages);
  const [showInactive, setShowInactive] = useState(false);
  const [colorFilter, setColorFilter] = useState("");
  const [undatedOnly, setUndatedOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formSession, setFormSession] = useState(0);
  const [form, setForm] = useState<TeethShortageFormState>(EMPTY_TEETH_SHORTAGE_FORM);
  const [formErrorMsg, setFormErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const [pending, startTransition] = useTransition();
  const todayKey = warsawNowParts().dateKey;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((row) => (showInactive ? true : row.active))
      .filter((row) =>
        colorFilter
          ? row.color.toLowerCase().includes(colorFilter.trim().toLowerCase())
          : true,
      )
      .filter((row) => (undatedOnly ? row.available_from == null : true))
      .filter((row) => {
        if (!q) return true;
        const hay = [
          row.supplier_name,
          row.product_line,
          row.color,
          row.mould,
          row.note,
          teethProductLineLabel(parseTeethProductLine(row.product_line)),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return matchesSearchWords(hay, q);
      })
      .slice()
      .sort((a, b) => {
        const ak = classifyTeethShortageAvailability(a.available_from, todayKey);
        const bk = classifyTeethShortageAvailability(b.available_from, todayKey);
        const rank = (k: typeof ak) => (k === "undated" ? 0 : k === "past" ? 1 : 2);
        const rd = rank(ak) - rank(bk);
        if (rd !== 0) return rd;
        const ad = a.available_from ?? "";
        const bd = b.available_from ?? "";
        if (ad !== bd) return ad.localeCompare(bd);
        return a.product_line.localeCompare(b.product_line);
      });
  }, [rows, showInactive, colorFilter, undatedOnly, query, todayKey]);

  const hasFilters = query.trim() !== "" || colorFilter.trim() !== "" || undatedOnly;

  function openCreate() {
    setForm(EMPTY_TEETH_SHORTAGE_FORM);
    setFormErrorMsg(null);
    setFormSession((n) => n + 1);
    setFormOpen(true);
  }

  function openEdit(row: TeethSupplierShortageWithSupplier) {
    setForm(teethShortageRowToForm(row));
    setFormErrorMsg(null);
    setFormSession((n) => n + 1);
    setFormOpen(true);
  }

  function saveForm(payload: TeethShortageFormState) {
    setFormErrorMsg(null);
    setForm(payload);
    startTransition(async () => {
      const result = await actionUpsertTeethShortage({
        id: payload.id,
        supplierId: payload.supplierId,
        productLine: payload.productLine,
        color: payload.color,
        mould: payload.mould,
        kind: payload.kind || null,
        availableFrom: payload.availableFrom,
        dateUndetermined: payload.dateUndetermined,
        note: payload.note,
      });
      if (!result.ok) {
        setFormErrorMsg(
          userFacingErrorTextFromMessage(result.error, "Nie udało się zapisać braku.")
        );
        return;
      }
      setFormOpen(false);
      setForm(EMPTY_TEETH_SHORTAGE_FORM);
      setToast(toastSuccess("Zapisano", "Wpis braku został zapisany."));
      const { actionListTeethShortages } = await import("@/app/actions/teeth-shortages");
      const next = await actionListTeethShortages({ includeInactive: true });
      setRows(next);
    });
  }

  function setActive(row: TeethSupplierShortageWithSupplier, active: boolean) {
    startTransition(async () => {
      const result = await actionSetTeethShortageActive({ id: row.id, active });
      if (!result.ok) {
        setToast(
          toastError(
            "Nie udało się",
            userFacingErrorTextFromMessage(result.error, "Spróbuj ponownie.")
          )
        );
        return;
      }
      setToast(
        toastSuccess(
          active ? "Przywrócono" : "Dezaktywowano",
          active
            ? "Wpis jest znowu widoczny przy prośbie."
            : "Ostrzeżenie przy prośbie nie będzie już pokazywane.",
        ),
      );
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, active } : r)),
      );
    });
  }

  return (
    <TeethPanelWorkspaceCard
      title={TEETH_BRAKI_PAGE_TITLE}
      hint={TEETH_BRAKI_PAGE_HINT}
      headerAside={
        <Button className="gap-1.5" onClick={openCreate} disabled={pending}>
          <IconPlusCircle size={16} />
          {TEETH_BRAKI_ADD_COPY.ctaLabel}
        </Button>
      }
      beforeCard={
        <>
          {loadError ? (
            <Alert tone="error" className="mb-4">
              {loadError}
            </Alert>
          ) : null}
          {toast ? (
            <NoticeToast notice={toast} onDismiss={() => setToast(null)} />
          ) : null}
        </>
      }
    >
      <TeethPanelTabPanel id="teeth-panel-view-braki" bare className="space-y-0">
        <div
          role="search"
          aria-label="Filtry braków"
          className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5"
        >
          <div className="relative w-full sm:max-w-xs sm:flex-1">
            <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Dostawca, linia, fason, notatka…"
              aria-label="Szukaj braków"
              className={fieldControlClass("default", "pl-9")}
            />
          </div>
          <input
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value)}
            placeholder="Kolor, np. A1"
            aria-label="Kolor"
            className={fieldControlClass("default", "w-36")}
          />
          <FilterChip
              label="Pokaż nieaktywne"
              active={showInactive}
              onClick={() => setShowInactive((v) => !v)}
            />
            <FilterChip
              label="Bez daty dostępności"
              active={undatedOnly}
              onClick={() => setUndatedOnly((v) => !v)}
            />
          <p className="ml-auto text-[0.6875rem] font-medium text-slate-500 tabular-nums" aria-live="polite">
            {filtered.length} {polishPluralWord(filtered.length, "brak", "braki", "braków")}
          </p>
        </div>

          {filtered.length === 0 ? (
            <EmptyState
              title={
                rows.length === 0
                  ? TEETH_BRAKI_ADD_COPY.emptyTitle
                  : TEETH_BRAKI_ADD_COPY.emptyFilteredTitle
              }
              description={
                rows.length === 0
                  ? TEETH_BRAKI_ADD_COPY.emptyDescription
                  : TEETH_BRAKI_ADD_COPY.emptyFilteredDescription
              }
              icon={<IconToothShortage size={26} strokeWidth={1.75} />}
              action={
                !hasFilters ? (
                  <Button variant="secondary" className="gap-1.5" onClick={openCreate} disabled={pending}>
                    <IconPlusCircle size={16} />
                    {rows.length === 0 ? TEETH_BRAKI_ADD_COPY.emptyAction : TEETH_BRAKI_ADD_COPY.ctaLabel}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery("");
                      setColorFilter("");
                      setUndatedOnly(false);
                    }}
                  >
                    Wyczyść filtry
                  </Button>
                )
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((row) => {
                const kindLabel = row.kind ? TEETH_KIND_LABELS[row.kind] : null;
                const lineLabel =
                  teethProductLineLabel(parseTeethProductLine(row.product_line)) ??
                  row.product_line;
                return (
                  <li
                    key={row.id}
                    className={cn(
                      "flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5",
                      !row.active && "bg-slate-50",
                    )}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {lineLabel}
                        </span>
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-[0.6875rem] font-medium ring-1",
                            teethShortageAvailabilityBadgeClass(row.available_from, todayKey),
                          )}
                        >
                          {teethShortageAvailabilityBadgeLabel(row.available_from, todayKey)}
                        </span>
                        {!row.active ? (
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[0.6875rem] font-medium text-slate-600">
                            Nieaktywny
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-600">
                        {row.supplier_name}
                        {" · "}
                        {row.color}
                        {row.mould ? ` · ${row.mould}` : ""}
                        {kindLabel ? ` · ${kindLabel}` : ""}
                      </p>
                      {row.note ? (
                        <p className="text-[0.6875rem] leading-snug text-amber-900/90">
                          <span className="font-medium text-amber-950/80">Uwaga: </span>
                          {row.note}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="min-h-11 sm:min-h-9"
                        disabled={pending}
                        onClick={() => openEdit(row)}
                      >
                        Edytuj
                      </Button>
                      {row.active ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="min-h-11 sm:min-h-9"
                          disabled={pending}
                          onClick={() => setActive(row, false)}
                        >
                          Dezaktywuj
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-11 sm:min-h-9"
                          disabled={pending}
                          onClick={() => setActive(row, true)}
                        >
                          Przywróć
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
      </TeethPanelTabPanel>

      <TeethShortageFormModal
        key={formSession}
        open={formOpen}
        form={form}
        onChange={setForm}
        onClose={() => {
          setFormOpen(false);
          setFormErrorMsg(null);
        }}
        onSave={saveForm}
        suppliers={suppliers}
        pending={pending}
        serverError={formErrorMsg}
      />
    </TeethPanelWorkspaceCard>
  );
}
