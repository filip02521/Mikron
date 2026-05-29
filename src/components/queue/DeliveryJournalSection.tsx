"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  actionCreateDeliveryReceipt,
  actionDeleteDeliveryReceipt,
  actionFetchCarrierHintForSupplier,
  actionFetchDeliveryJournalForDate,
  actionFetchTodayDeliveryJournal,
  actionUpdateDeliveryReceipt,
} from "@/app/actions/warehouse-delivery";
import { shiftJournalDateKey } from "@/lib/warehouse/delivery-receipts";
import { DeliveryJournalInsightsPanel } from "@/components/queue/DeliveryJournalInsightsPanel";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { WarehouseDeliveryReceipt } from "@/lib/warehouse/delivery-receipts";
import {
  WAREHOUSE_CARRIERS,
  WAREHOUSE_SHIPMENT_FORMS,
  warehouseCarrierLabel,
  warehouseShipmentFormLabel,
  type WarehouseCarrier,
  type WarehouseShipmentForm,
} from "@/lib/warehouse/delivery-carriers";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, fieldControlClass } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

type SupplierOption = { id: string; name: string; subiektKhId: number | null };

type FormState = {
  supplierId: string;
  supplierOther: string;
  carrier: WarehouseCarrier;
  shipmentForm: WarehouseShipmentForm;
  packageCount: string;
  palletCount: string;
  note: string;
};

const EMPTY_FORM: FormState = {
  supplierId: "",
  supplierOther: "",
  carrier: "inpost",
  shipmentForm: "paczki",
  packageCount: "1",
  palletCount: "0",
  note: "",
};

/** Po zapisie zostaw dostawcę i kuriera — szybkie wpisywanie kolejnych dostaw. */
function formStateForNextEntry(previous: FormState): FormState {
  return {
    supplierId: previous.supplierId,
    supplierOther: "",
    carrier: previous.carrier,
    shipmentForm: previous.shipmentForm,
    packageCount: previous.packageCount,
    palletCount: previous.palletCount,
    note: "",
  };
}

function formatTodayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}.${m}.${y}`;
}

type JournalSubView = "entries" | "insights";

function JournalDateStepButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        fieldControlClass(),
        "flex w-11 shrink-0 items-center justify-center !px-0 text-lg font-medium leading-none text-slate-700",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function ReceiptRow({
  receipt,
  suppliers,
  pending,
  readOnly,
  onSaved,
  onDeleted,
}: {
  receipt: WarehouseDeliveryReceipt;
  suppliers: SupplierOption[];
  pending: boolean;
  readOnly?: boolean;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(() => ({
    supplierId: receipt.supplierId ?? "",
    supplierOther: receipt.supplierId ? "" : receipt.supplierLabel,
    carrier: receipt.carrier,
    shipmentForm: receipt.shipmentForm,
    packageCount: String(receipt.packageCount),
    palletCount: String(receipt.palletCount),
    note: receipt.note,
  }));

  const save = () => {
    const supplierId = form.supplierId || null;
    const supplierLabel = supplierId ? undefined : form.supplierOther.trim();
    void actionUpdateDeliveryReceipt({
      id: receipt.id,
      supplierId,
      supplierLabel,
      carrier: form.carrier,
      shipmentForm: form.shipmentForm,
      packageCount: Number(form.packageCount) || 0,
      palletCount: Number(form.palletCount) || 0,
      note: form.note,
    })
      .then(() => {
        setEditing(false);
        onSaved();
      })
      .catch(() => onSaved());
  };

  if (!editing) {
    return (
      <li className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-900">{receipt.supplierName}</p>
            <p className="mt-1 text-sm text-slate-600">
              {warehouseCarrierLabel(receipt.carrier)} ·{" "}
              {warehouseShipmentFormLabel(receipt.shipmentForm)}
              {receipt.packageCount > 0 ? ` · ${receipt.packageCount} pacz.` : ""}
              {receipt.palletCount > 0 ? ` · ${receipt.palletCount} pal.` : ""}
            </p>
            {receipt.note ? (
              <p className="mt-1 text-xs text-slate-500">{receipt.note}</p>
            ) : null}
          </div>
          {!readOnly ? (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={pending} onClick={() => setEditing(true)}>
                Edytuj
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => {
                  if (window.confirm("Usunąć wpis z dzisiejszego dziennika?")) {
                    void actionDeleteDeliveryReceipt(receipt.id).then(onDeleted);
                  }
                }}
              >
                Usuń
              </Button>
            </div>
          ) : null}
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-indigo-200 bg-indigo-50/40 px-4 py-3">
      <ReceiptFormFields
        form={form}
        setForm={setForm}
        suppliers={suppliers}
        disabled={pending}
      />
      <div className="mt-2 flex gap-2">
        <Button variant="primary" size="sm" disabled={pending} onClick={save}>
          Zapisz
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => setEditing(false)}>
          Anuluj
        </Button>
      </div>
    </li>
  );
}

function ReceiptFormFields({
  form,
  setForm,
  suppliers,
  disabled,
  onSubmitShortcut,
  carrierHintLabel,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  suppliers: SupplierOption[];
  disabled?: boolean;
  onSubmitShortcut?: () => void;
  carrierHintLabel?: string | null;
}) {
  const showPallets =
    form.shipmentForm === "palety" || form.shipmentForm === "paczki_i_palety";
  const showPackages =
    form.shipmentForm === "paczki" || form.shipmentForm === "paczki_i_palety";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Dostawca">
        <Select
          value={form.supplierId}
          onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}
          disabled={disabled}
        >
          <option value="">— inny / wpisz poniżej —</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      {!form.supplierId ? (
        <Field label="Nazwa (gdy brak na liście)">
          <Input
            value={form.supplierOther}
            onChange={(e) => setForm((f) => ({ ...f, supplierOther: e.target.value }))}
            disabled={disabled}
            placeholder="np. kurier bez faktury"
          />
        </Field>
      ) : (
        <div className="hidden sm:block" />
      )}
      <Field label="Kurier / sposób">
        <Select
          value={form.carrier}
          onChange={(e) =>
            setForm((f) => ({ ...f, carrier: e.target.value as WarehouseCarrier }))
          }
          disabled={disabled}
        >
          {WAREHOUSE_CARRIERS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        {carrierHintLabel ? (
          <p className="mt-1 text-[11px] text-emerald-700">{carrierHintLabel}</p>
        ) : null}
      </Field>
      <Field label="Forma">
        <Select
          value={form.shipmentForm}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              shipmentForm: e.target.value as WarehouseShipmentForm,
            }))
          }
          disabled={disabled}
        >
          {WAREHOUSE_SHIPMENT_FORMS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </Field>
      {showPackages ? (
        <Field label="Liczba paczek">
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={form.packageCount}
            onChange={(e) => setForm((f) => ({ ...f, packageCount: e.target.value }))}
            disabled={disabled}
          />
        </Field>
      ) : null}
      {showPallets ? (
        <Field label="Liczba palet">
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={form.palletCount}
            onChange={(e) => setForm((f) => ({ ...f, palletCount: e.target.value }))}
            disabled={disabled}
          />
        </Field>
      ) : null}
      <Field label="Notatka" className="sm:col-span-2">
        <Input
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          disabled={disabled}
          placeholder="nr listu, uwagi…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onSubmitShortcut?.();
            }
          }}
        />
      </Field>
    </div>
  );
}

export function DeliveryJournalSection({
  suppliers,
  initialJournal,
  todayDateKey,
  isMagazynRole = false,
}: {
  suppliers: SupplierOption[];
  initialJournal: {
    date: string;
    receipts: WarehouseDeliveryReceipt[];
    summary: { receiptCount: number; packageCount: number; palletCount: number };
  };
  todayDateKey: string;
  isMagazynRole?: boolean;
}) {
  const [pending, start] = useTransition();
  const [journal, setJournal] = useState(initialJournal);
  const [viewDate, setViewDate] = useState(initialJournal.date);
  const [subView, setSubView] = useState<JournalSubView>("entries");
  const [formOpen, setFormOpen] = useState(true);
  const canBrowseDates = !isMagazynRole;
  const isViewingToday = journal.date === todayDateKey;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [carrierHintLabel, setCarrierHintLabel] = useState<string | null>(null);
  const formPanelRef = useRef<HTMLDivElement>(null);

  const loadJournal = useCallback((dateKey: string) => {
    start(async () => {
      try {
        const next = canBrowseDates
          ? await actionFetchDeliveryJournalForDate(dateKey)
          : await actionFetchTodayDeliveryJournal();
        setJournal(next);
        setViewDate(next.date);
      } catch (e) {
        setToast({
          text: e instanceof Error ? e.message : "Błąd ładowania dziennika",
          tone: "error",
        });
      }
    });
  }, [canBrowseDates]);

  const refresh = useCallback(() => {
    loadJournal(canBrowseDates ? viewDate : todayDateKey);
  }, [canBrowseDates, viewDate, todayDateKey, loadJournal]);

  useEffect(() => {
    if (!form.supplierId) {
      setCarrierHintLabel(null);
      return;
    }
    let cancelled = false;
    setCarrierHintLabel(null);
    void actionFetchCarrierHintForSupplier(form.supplierId).then((hint) => {
      if (cancelled) return;
      if (!hint) {
        setCarrierHintLabel(null);
        return;
      }
      setForm((f) => ({
        ...f,
        carrier: hint.carrier,
        shipmentForm: hint.shipmentForm,
        packageCount: String(hint.typicalPackageCount || 1),
        palletCount: String(hint.typicalPalletCount || 0),
      }));
      const sourceLabel =
        hint.source === "default" ? "Z katalogu dostawcy" : "Z historii wpisów";
      setCarrierHintLabel(
        `${sourceLabel}: ${warehouseCarrierLabel(hint.carrier)} · ${warehouseShipmentFormLabel(hint.shipmentForm)}`
      );
    });
    return () => {
      cancelled = true;
    };
  }, [form.supplierId]);

  const summaryLine = useMemo(() => {
    const parts: string[] = [];
    if (journal.summary.receiptCount > 0) {
      parts.push(
        `${journal.summary.receiptCount} ${
          journal.summary.receiptCount === 1 ? "dostawa" : "dostaw"
        }`
      );
    }
    if (journal.summary.packageCount > 0) {
      parts.push(`${journal.summary.packageCount} pacz.`);
    }
    if (journal.summary.palletCount > 0) {
      parts.push(`${journal.summary.palletCount} pal.`);
    }
    return parts.join(" · ") || "Brak wpisów";
  }, [journal.summary]);

  const focusForm = useCallback(() => {
    requestAnimationFrame(() => {
      const panel = formPanelRef.current;
      const firstField = panel?.querySelector<HTMLElement>(
        "select, input:not([type='hidden'])"
      );
      firstField?.focus();
      panel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const submitNew = useCallback(() => {
    if (pending) return;
    const snapshot = form;
    start(async () => {
      try {
        await actionCreateDeliveryReceipt({
          supplierId: snapshot.supplierId || null,
          supplierLabel: snapshot.supplierId ? undefined : snapshot.supplierOther,
          carrier: snapshot.carrier,
          shipmentForm: snapshot.shipmentForm,
          packageCount: Number(snapshot.packageCount) || 0,
          palletCount: Number(snapshot.palletCount) || 0,
          note: snapshot.note,
        });
        setForm(formStateForNextEntry(snapshot));
        setFormOpen(true);
        setToast({ text: "Zapisano — wpisz kolejną dostawę.", tone: "success" });
        refresh();
        focusForm();
      } catch (e) {
        setToast({
          text: e instanceof Error ? e.message : "Błąd zapisu",
          tone: "error",
        });
      }
    });
  }, [form, pending, refresh, focusForm]);

  useEffect(() => {
    if (!formOpen || !isViewingToday) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey)) return;
      const panel = formPanelRef.current;
      if (!panel?.contains(document.activeElement)) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-delivery-journal-skip-shortcut]")) return;
      e.preventDefault();
      submitNew();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [formOpen, isViewingToday, submitNew]);

  useEffect(() => {
    if (formOpen && isViewingToday) focusForm();
  }, [formOpen, isViewingToday, focusForm]);

  const showEntries = !isMagazynRole || subView === "entries";
  const goPrevDay = () => loadJournal(shiftJournalDateKey(viewDate, -1));
  const goNextDay = () => {
    if (isViewingToday) return;
    const next = shiftJournalDateKey(viewDate, 1);
    if (next > todayDateKey) return;
    loadJournal(next);
  };

  return (
    <section className="scroll-mt-20" id="dziennik-dostaw">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Dziennik dostaw</h2>
            {showEntries ? (
              <p className="mt-0.5 text-xs text-slate-600">
                {isViewingToday ? (
                  <>
                    Dziś ({formatTodayLabel(journal.date)}) — {summaryLine}.{" "}
                    {isMagazynRole ? (
                      <span className="text-slate-500">
                        Skrót:{" "}
                        <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[10px]">
                          Ctrl
                        </kbd>
                        +
                        <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[10px]">
                          Enter
                        </kbd>{" "}
                        — zapisz i następna pozycja.
                      </span>
                    ) : (
                      <span className="text-slate-500">
                        Możesz przełączyć datę, aby zobaczyć archiwum (tylko podgląd).
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    Podgląd: {formatTodayLabel(journal.date)} — {summaryLine}. Tylko odczyt; nowe
                    wpisy dodaje magazyn na dziś.
                  </>
                )}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-slate-600">
                Archiwum, filtry i podsumowania — bez edycji wpisów.
              </p>
            )}
          </div>
          {showEntries && isViewingToday && isMagazynRole ? (
            <Button
              variant="primary"
              size="sm"
              disabled={pending}
              onClick={() => setFormOpen((o) => !o)}
            >
              {formOpen ? "Zwiń formularz" : "+ Dostawa"}
            </Button>
          ) : null}
          {showEntries && canBrowseDates && !isViewingToday ? (
            <Button
              variant="primary"
              size="sm"
              disabled={pending}
              onClick={() => loadJournal(todayDateKey)}
            >
              Dziś
            </Button>
          ) : null}
        </div>

        {isMagazynRole ? (
          <div className="mt-3">
            <SegmentedControl<JournalSubView>
              ariaLabel="Widok dziennika dostaw"
              value={subView}
              onChange={setSubView}
              touchFriendly
              className="w-full sm:w-auto"
              options={[
                { value: "entries", label: "Wpisy na dziś", title: "Szybkie wpisywanie dostaw" },
                {
                  value: "insights",
                  label: "Archiwum i raporty",
                  title: "Wyszukiwanie i podsumowania",
                },
              ]}
            />
          </div>
        ) : null}
      </div>

      {!showEntries ? (
        <DeliveryJournalInsightsPanel suppliers={suppliers} todayDateKey={todayDateKey} />
      ) : (
        <div className="px-4 py-5 sm:px-6">
      {canBrowseDates ? (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          <Field label="Data" className="min-w-[12.5rem] flex-1 sm:max-w-[17rem]">
            <div className="flex gap-1.5">
              <JournalDateStepButton
                disabled={pending}
                onClick={goPrevDay}
                title="Poprzedni dzień"
                aria-label="Poprzedni dzień"
              >
                ←
              </JournalDateStepButton>
              <Input
                type="date"
                className="min-w-0 flex-1"
                value={viewDate}
                max={todayDateKey}
                disabled={pending}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) loadJournal(v);
                }}
              />
              <JournalDateStepButton
                disabled={pending || isViewingToday}
                onClick={goNextDay}
                title="Następny dzień"
                aria-label="Następny dzień"
              >
                →
              </JournalDateStepButton>
            </div>
          </Field>
          {!isViewingToday ? (
            <Button
              variant="secondary"
              size="md"
              className="min-h-11 shrink-0"
              disabled={pending}
              onClick={() => loadJournal(todayDateKey)}
            >
              Wróć na dziś
            </Button>
          ) : null}
        </div>
      ) : null}

      {formOpen && isViewingToday && isMagazynRole ? (
        <div
          ref={formPanelRef}
          className={cn(
            "mt-4 rounded-xl border border-amber-200/90 bg-amber-50/50 p-4",
            pending && "opacity-70"
          )}
        >
          <ReceiptFormFields
            form={form}
            setForm={setForm}
            suppliers={suppliers}
            disabled={pending}
            onSubmitShortcut={submitNew}
            carrierHintLabel={carrierHintLabel}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" disabled={pending} onClick={submitNew}>
              Zapisz i kolejna
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              data-delivery-journal-skip-shortcut
              onClick={() => setFormOpen(false)}
            >
              Zwiń formularz
            </Button>
            <span className="text-[11px] text-slate-500">Ctrl+Enter</span>
          </div>
        </div>
      ) : null}

      <ul className="mt-4 space-y-2">
        {journal.receipts.map((r) => (
          <ReceiptRow
            key={r.id}
            receipt={r}
            suppliers={suppliers}
            pending={pending}
            readOnly={!isViewingToday}
            onSaved={refresh}
            onDeleted={refresh}
          />
        ))}
      </ul>

      {!journal.receipts.length && (!formOpen || !isViewingToday || !isMagazynRole) ? (
        <div className="mt-4">
          <EmptyState
            title={isViewingToday ? "Brak wpisów na dziś" : "Brak wpisów w tym dniu"}
            description={
              isViewingToday
                ? "Magazyn dodaje dostawy w zakładce Wpisy na dziś."
                : "Wybierz inną datę lub wróć na dziś."
            }
          />
        </div>
      ) : null}

        </div>
      )}

      {toast ? <Toast message={toast.text} tone={toast.tone} onDismiss={() => setToast(null)} /> : null}
    </section>
  );
}
