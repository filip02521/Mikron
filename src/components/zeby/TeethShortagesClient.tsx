"use client";

import { useMemo, useState, useTransition } from "react";
import {
  actionSetTeethShortageActive,
  actionUpsertTeethShortage,
} from "@/app/actions/teeth-shortages";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { IconAlertCircle } from "@/components/icons/StrokeIcons";
import { TeethPanelWorkspaceCard } from "@/components/zeby/TeethPanelWorkspaceCard";
import { TeethPanelTabPanel } from "@/components/zeby/TeethPanelSection";
import {
  TeethShortageAddCta,
  TeethShortageEmptyGraphic,
} from "@/components/zeby/TeethShortageAddCta";
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
import { TEETH_BRAKI_ICON_TILE } from "@/lib/teeth/teeth-panel-shell";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
} from "@/lib/ui/ontime-theme";
import { toastError, toastSuccess, type ToastNotice } from "@/lib/ui/notice-copy";
import { warsawNowParts } from "@/lib/time/warsaw";
import type { TeethSupplierShortageWithSupplier } from "@/types/database";

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
        "inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-xs",
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
        return hay.includes(q);
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
        setFormErrorMsg(result.error);
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
        setToast(toastError("Nie udało się", result.error));
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
      icon={<IconAlertCircle size={20} />}
      iconTileClassName={TEETH_BRAKI_ICON_TILE}
      headerAside={
        <TeethShortageAddCta compact onClick={openCreate} disabled={pending} />
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
      <TeethPanelTabPanel id="teeth-panel-view-braki" labelledBy="teeth-nav-braki">
        <div className="space-y-3 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
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
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-600">
              Kolor
              <Input
                className="mt-1"
                value={colorFilter}
                onChange={(e) => setColorFilter(e.target.value)}
                placeholder="np. A1"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Szukaj
              <Input
                className="mt-1"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="dostawca, linia, fason, notatka…"
              />
            </label>
          </div>

          {filtered.length === 0 ? (
            <div className="overflow-hidden rounded-md border border-amber-200/60 bg-gradient-to-b from-amber-50/80 via-white to-white shadow-sm">
              <div className="relative px-4 py-10 text-center sm:px-6 sm:py-12">
                <span
                  className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_at_top,_rgba(245,158,11,0.14),_transparent_70%)]"
                  aria-hidden
                />
                <div className="relative">
                  <TeethShortageEmptyGraphic className="mb-4" />
                  <p className="text-sm font-semibold text-slate-900">
                    {rows.length === 0
                      ? TEETH_BRAKI_ADD_COPY.emptyTitle
                      : TEETH_BRAKI_ADD_COPY.emptyFilteredTitle}
                  </p>
                  <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-500">
                    {rows.length === 0
                      ? TEETH_BRAKI_ADD_COPY.emptyDescription
                      : TEETH_BRAKI_ADD_COPY.emptyFilteredDescription}
                  </p>
                  <div className="mt-5 flex justify-center">
                    <TeethShortageAddCta
                      onClick={openCreate}
                      disabled={pending}
                      label={
                        rows.length === 0
                          ? TEETH_BRAKI_ADD_COPY.emptyAction
                          : TEETH_BRAKI_ADD_COPY.ctaLabel
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200/80 bg-white">
              {filtered.map((row) => {
                const kindLabel = row.kind ? TEETH_KIND_LABELS[row.kind] : null;
                const lineLabel =
                  teethProductLineLabel(parseTeethProductLine(row.product_line)) ??
                  row.product_line;
                return (
                  <li
                    key={row.id}
                    className={cn(
                      "flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between",
                      !row.active && "bg-slate-50/80 opacity-75",
                    )}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {lineLabel}
                        </span>
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1",
                            teethShortageAvailabilityBadgeClass(row.available_from, todayKey),
                          )}
                        >
                          {teethShortageAvailabilityBadgeLabel(row.available_from, todayKey)}
                        </span>
                        {!row.active ? (
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
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
                        <p className="text-[11px] leading-snug text-amber-900/90">
                          <span className="font-medium text-amber-950/80">Uwaga: </span>
                          {row.note}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => openEdit(row)}
                      >
                        Edytuj
                      </Button>
                      {row.active ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => setActive(row, false)}
                        >
                          Dezaktywuj
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
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
        </div>
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
