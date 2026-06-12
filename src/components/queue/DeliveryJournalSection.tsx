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
import {
  formStateForNextEntry,
  type DeliveryJournalFormState,
} from "@/lib/warehouse/delivery-journal-form";
import { shiftJournalDateKey } from "@/lib/warehouse/delivery-receipts";
import { matchesDeliveryReceiptQuery } from "@/lib/warehouse/delivery-journal-insights";
import { DeliveryJournalReceiptCard } from "@/components/queue/delivery-journal/DeliveryJournalReceiptCard";
import { DeliveryJournalSearchField } from "@/components/queue/delivery-journal/DeliveryJournalSearchField";
import { DeliveryJournalInsightsPanel } from "@/components/queue/DeliveryJournalInsightsPanel";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { WarehouseDeliveryReceipt } from "@/lib/warehouse/delivery-receipts";
import { usePreviewMutationBlocker } from "@/components/layout/usePreviewMutationBlocker";
import {
  WAREHOUSE_CARRIERS,
  WAREHOUSE_SHIPMENT_FORMS,
  normalizeShipmentCounts,
  shipmentFormShowsPackages,
  shipmentFormShowsPallets,
  warehouseCarrierLabel,
  warehouseShipmentFormLabel,
  type WarehouseCarrier,
  type WarehouseShipmentForm,
} from "@/lib/warehouse/delivery-carriers";
import { QueueSupplierDirectoryField } from "@/components/queue/QueueSupplierDirectoryField";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, fieldControlClass } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { brandLinkClass, panelSectionInsetClass, panelTypography } from "@/lib/ui/ontime-theme";
import { IconChevronLeft, IconChevronRight } from "@/components/icons/StrokeIcons";

type SupplierOption = { id: string; name: string; subiektKhId: number | null };

type FormState = DeliveryJournalFormState;

const EMPTY_FORM: FormState = {
  supplierId: "",
  supplierOther: "",
  carrier: "inpost",
  shipmentForm: "paczki",
  packageCount: "1",
  palletCount: "0",
  note: "",
};

function countsToFormFields(
  shipmentForm: WarehouseShipmentForm,
  packageCount: number,
  palletCount: number
): Pick<FormState, "packageCount" | "palletCount"> {
  const counts = normalizeShipmentCounts(shipmentForm, packageCount, palletCount);
  return {
    packageCount: String(
      counts.packageCount || (shipmentFormShowsPackages(shipmentForm) ? 1 : 0)
    ),
    palletCount: String(
      counts.palletCount || (shipmentFormShowsPallets(shipmentForm) ? 1 : 0)
    ),
  };
}

function formCountsForSubmit(form: FormState): {
  packageCount: number;
  palletCount: number;
} {
  return normalizeShipmentCounts(
    form.shipmentForm,
    Number(form.packageCount) || 0,
    Number(form.palletCount) || 0
  );
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
  highlightQuery,
  onSaved,
  onDeleted,
}: {
  receipt: WarehouseDeliveryReceipt;
  suppliers: SupplierOption[];
  pending: boolean;
  readOnly?: boolean;
  highlightQuery?: string;
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
      ...formCountsForSubmit(form),
      note: form.note,
    })
      .then(() => {
        setEditing(false);
        onSaved();
      })
      .catch((err) => {
        window.alert(err instanceof Error ? err.message : "Nie udało się zapisać wpisu dziennika.");
      });
  };

  if (!editing) {
    return (
      <DeliveryJournalReceiptCard
        receipt={receipt}
        highlightQuery={highlightQuery}
        actions={
          !readOnly ? (
            <>
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
            </>
          ) : undefined
        }
      />
    );
  }

  return (
    <li className="rounded-md border border-indigo-200 bg-indigo-50/40 px-4 py-3">
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
  supplierFieldKey,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  suppliers: SupplierOption[];
  disabled?: boolean;
  onSubmitShortcut?: () => void;
  carrierHintLabel?: string | null;
  /** Remount typeahead — czyści tekst w polu po zapisie. */
  supplierFieldKey?: number;
}) {
  const showPallets = shipmentFormShowsPallets(form.shipmentForm);
  const showPackages = shipmentFormShowsPackages(form.shipmentForm);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Dostawca">
        <QueueSupplierDirectoryField
          key={supplierFieldKey}
          suppliers={suppliers}
          value={form.supplierId}
          onChange={(supplierId) => setForm((f) => ({ ...f, supplierId }))}
          disabled={disabled}
        />
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
          onChange={(e) => {
            const shipmentForm = e.target.value as WarehouseShipmentForm;
            setForm((f) => ({
              ...f,
              shipmentForm,
              ...countsToFormFields(
                shipmentForm,
                Number(f.packageCount) || 0,
                Number(f.palletCount) || 0
              ),
            }));
          }}
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
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const { readOnly: previewReadOnly, blockIfReadOnly } = usePreviewMutationBlocker(
    (text) => setToast({ text, tone: "error" })
  );
  const [pending, start] = useTransition();
  const [journal, setJournal] = useState(initialJournal);
  const [viewDate, setViewDate] = useState(initialJournal.date);
  const [subView, setSubView] = useState<JournalSubView>("entries");
  const [formOpen, setFormOpen] = useState(true);
  const canBrowseDates = !isMagazynRole;
  const isViewingToday = journal.date === todayDateKey;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [carrierHintLabel, setCarrierHintLabel] = useState<string | null>(null);
  const [carrierHintForSupplierId, setCarrierHintForSupplierId] = useState<string | null>(null);
  const [supplierFieldKey, setSupplierFieldKey] = useState(0);
  const [entrySearch, setEntrySearch] = useState("");
  const [archiveSearchSeed, setArchiveSearchSeed] = useState("");
  const formPanelRef = useRef<HTMLDivElement>(null);
  const visibleCarrierHint =
    form.supplierId && carrierHintForSupplierId === form.supplierId ? carrierHintLabel : null;

  const loadJournal = useCallback((dateKey: string) => {
    start(async () => {
      try {
        const next = canBrowseDates
          ? await actionFetchDeliveryJournalForDate(dateKey)
          : await actionFetchTodayDeliveryJournal();
        setJournal(next);
        setViewDate(next.date);
        setEntrySearch("");
        setArchiveSearchSeed("");
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
    if (!form.supplierId) return;
    let cancelled = false;
    void actionFetchCarrierHintForSupplier(form.supplierId).then((hint) => {
      if (cancelled) return;
      if (!hint) {
        setCarrierHintForSupplierId(form.supplierId);
        setCarrierHintLabel(null);
        return;
      }
      setForm((f) => ({
        ...f,
        carrier: hint.carrier,
        shipmentForm: hint.shipmentForm,
        ...countsToFormFields(
          hint.shipmentForm,
          hint.typicalPackageCount,
          hint.typicalPalletCount
        ),
      }));
      const sourceLabel =
        hint.source === "default" ? "Z katalogu dostawcy" : "Z historii wpisów";
      setCarrierHintForSupplierId(form.supplierId);
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

  const goToArchive = useCallback((query?: string) => {
    setArchiveSearchSeed(query?.trim() ?? "");
    setSubView("insights");
  }, []);

  const filteredReceipts = useMemo(() => {
    const q = entrySearch.trim();
    if (!q) return journal.receipts;
    return journal.receipts.filter((r) => matchesDeliveryReceiptQuery(r, q));
  }, [journal.receipts, entrySearch]);

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
    if (blockIfReadOnly()) return;
    const snapshot = form;
    start(async () => {
      try {
        await actionCreateDeliveryReceipt({
          supplierId: snapshot.supplierId || null,
          supplierLabel: snapshot.supplierId ? undefined : snapshot.supplierOther,
          carrier: snapshot.carrier,
          shipmentForm: snapshot.shipmentForm,
          ...formCountsForSubmit(snapshot),
          note: snapshot.note,
        });
        setForm(formStateForNextEntry(snapshot));
        setCarrierHintLabel(null);
        setCarrierHintForSupplierId(null);
        setSupplierFieldKey((key) => key + 1);
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
  }, [blockIfReadOnly, form, pending, refresh, focusForm]);

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
      <div className={cn("border-b border-slate-100", panelSectionInsetClass)}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={panelTypography.sectionTitle}>Dziennik dostaw</h2>
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
                  label: "Archiwum",
                  title: "Wyszukiwanie paczek i podsumowania",
                },
              ]}
            />
          </div>
        ) : null}
      </div>

      {!showEntries ? (
        <DeliveryJournalInsightsPanel
          key={archiveSearchSeed || "default"}
          suppliers={suppliers}
          todayDateKey={todayDateKey}
          initialQuery={archiveSearchSeed}
        />
      ) : (
        <div className="px-4 py-5 sm:px-6">
      {canBrowseDates ? (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-slate-200 bg-slate-50/80 p-3">
          <Field label="Data" className="min-w-[12.5rem] flex-1 sm:max-w-[17rem]">
            <div className="flex gap-1.5">
              <JournalDateStepButton
                disabled={pending}
                onClick={goPrevDay}
                title="Poprzedni dzień"
                aria-label="Poprzedni dzień"
              >
                <IconChevronLeft size={18} strokeWidth={2.25} aria-hidden />
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
                <IconChevronRight size={18} strokeWidth={2.25} aria-hidden />
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
            "mt-4 rounded-md border border-amber-200/90 bg-amber-50/50 p-4",
            pending && "opacity-70"
          )}
        >
          <ReceiptFormFields
            form={form}
            setForm={setForm}
            suppliers={suppliers}
            disabled={pending}
            onSubmitShortcut={submitNew}
            carrierHintLabel={visibleCarrierHint}
            supplierFieldKey={supplierFieldKey}
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

      {journal.receipts.length > 0 ? (
        <div className="mb-4 space-y-1.5 rounded-md border border-emerald-100/70 bg-white p-2 shadow-sm">
          <DeliveryJournalSearchField
            id="journal-day-search"
            label="Szukaj w tym dniu"
            value={entrySearch}
            disabled={pending}
            placeholder="Nr listu, dostawca, kurier…"
            onChange={setEntrySearch}
          />
          {entrySearch.trim() ? (
            <p className={cn(panelTypography.caption, "px-0.5")}>
              {filteredReceipts.length} z {journal.receipts.length}{" "}
              {journal.receipts.length === 1 ? "wpisu" : "wpisów"}
            </p>
          ) : isMagazynRole ? (
            <p className={cn(panelTypography.caption, "px-0.5")}>
              Szukasz wcześniej?{" "}
              <button
                type="button"
                className={brandLinkClass}
                onClick={() => goToArchive()}
              >
                Archiwum
              </button>
            </p>
          ) : null}
        </div>
      ) : null}

      <ul className="mt-4 space-y-2">
        {filteredReceipts.map((r) => (
          <ReceiptRow
            key={r.id}
            receipt={r}
            suppliers={suppliers}
            pending={pending}
            readOnly={previewReadOnly || !isViewingToday}
            onSaved={refresh}
            onDeleted={refresh}
            highlightQuery={entrySearch.trim() || undefined}
          />
        ))}
      </ul>

      {!filteredReceipts.length &&
      journal.receipts.length > 0 &&
      entrySearch.trim() ? (
        <div className="mt-4">
          <EmptyState
            title="Brak wyników na ten dzień"
            description={
              isMagazynRole
                ? "Spróbuj innej frazy albo przeszukaj wcześniejsze dni w Archiwum."
                : "Spróbuj innej frazy albo wybierz inną datę."
            }
            action={
              isMagazynRole ? (
                <Button variant="secondary" size="sm" onClick={() => goToArchive(entrySearch)}>
                  Szukaj w Archiwum
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : null}

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
