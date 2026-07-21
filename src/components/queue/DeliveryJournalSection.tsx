"use client";
import { ToastNotice, WAREHOUSE_TOAST } from "@/lib/ui/notice-copy";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  actionCreateDeliveryReceipt,
  actionDeleteDeliveryReceipt,
  actionFetchCarrierHintForSupplier,
  actionFetchDeliveryJournalForDate,
  actionUpdateDeliveryReceipt,
} from "@/app/actions/warehouse-delivery";
import {
  formStateForNextEntry,
  createEmptyDeliveryJournalForm,
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
import type { WarehouseCarrierRow } from "@/lib/data/warehouse-carriers";
import { WarehouseCarriersModal } from "@/components/queue/WarehouseCarriersModal";
import { CarrierPhonesModal } from "@/components/queue/CarrierPhonesModal";
import { IconPhone } from "@/components/icons/StrokeIcons";
import {
  WAREHOUSE_SHIPMENT_FORMS,
  defaultWarehouseCarrierSlug,
  normalizeShipmentCounts,
  resolveWarehouseFormCarrier,
  shipmentFormShowsPackages,
  shipmentFormShowsPallets,
  warehouseCarrierLabel,
  warehouseCarrierOptionsForSelect,
  warehouseShipmentFormLabel,
  type WarehouseCarrier,
  type WarehouseShipmentForm,
} from "@/lib/warehouse/delivery-carriers";
import { QueueSupplierDirectoryField } from "@/components/queue/QueueSupplierDirectoryField";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, fieldControlClass } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { IconChevronLeft, IconChevronRight } from "@/components/icons/StrokeIcons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/cn";
import {
  brandLinkClass,
  panelMetricTileClass,
  panelSectionInsetClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";
import {
  QUEUE_LIST_BODY_CLASS,
  journalComposeShellClass,
  journalEditShellClass,
  journalToolbarCardClass,
  queueToolbarFieldLabelClass,
  queueToolbarShellClass,
} from "@/lib/ui/queue-panel-styles";

type SupplierOption = { id: string; name: string; subiektKhId: number | null };

type FormState = DeliveryJournalFormState;

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
  const rawPackages = Number(form.packageCount) || 0;
  const rawPallets = Number(form.palletCount) || 0;
  if (shipmentFormShowsPackages(form.shipmentForm) && rawPackages < 1) {
    throw new Error("Liczba paczek musi wynosić co najmniej 1.");
  }
  return normalizeShipmentCounts(form.shipmentForm, rawPackages, rawPallets);
}

function formatTodayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}.${m}.${y}`;
}

type JournalSubView = "entries" | "insights";

function DaySummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={cn(panelMetricTileClass, "border-emerald-100/70 bg-white px-3 py-2.5")}>
      <p className={panelTypography.caption}>{label}</p>
      <p className={cn(panelTypography.statValue, "mt-0.5 text-lg")}>{value}</p>
    </div>
  );
}

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
  carriers,
  pending,
  readOnly,
  highlightQuery,
  onSaved,
  onDeleted,
  onError,
  canManageCarriers,
  onManageCarriers,
  pendingCount,
}: {
  receipt: WarehouseDeliveryReceipt;
  suppliers: SupplierOption[];
  carriers: WarehouseCarrierRow[];
  pending: boolean;
  readOnly?: boolean;
  highlightQuery?: string;
  onSaved: () => void;
  onDeleted: () => void;
  onError: (message: string) => void;
  canManageCarriers?: boolean;
  onManageCarriers?: () => void;
  pendingCount?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => ({
    supplierId: receipt.supplierId ?? "",
    supplierOther: receipt.supplierId ? "" : receipt.supplierLabel,
    carrier: receipt.carrier,
    shipmentForm: receipt.shipmentForm,
    packageCount: String(receipt.packageCount),
    palletCount: String(receipt.palletCount),
    note: receipt.note,
  }));

  const defaultRowCarrier = defaultWarehouseCarrierSlug(carriers);
  const formCarrier = resolveWarehouseFormCarrier(form.carrier, carriers, defaultRowCarrier);

  const save = () => {
    const supplierId = form.supplierId || null;
    const supplierLabel = supplierId ? undefined : form.supplierOther.trim();
    let counts;
    try {
      counts = formCountsForSubmit(form);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Nieprawidłowe dane.");
      return;
    }
    void actionUpdateDeliveryReceipt({
      id: receipt.id,
      supplierId,
      supplierLabel,
      carrier: formCarrier,
      shipmentForm: form.shipmentForm,
      ...counts,
      note: form.note,
    })
      .then(() => {
        setEditing(false);
        onSaved();
      })
      .catch((err) => {
        onError(err instanceof Error ? err.message : "Nie udało się zapisać wpisu dziennika.");
      });
  };

  if (!editing) {
    return (
      <>
        <ConfirmDialog
          open={deleteOpen}
          title="Usunąć wpis?"
          message="Wpis zniknie z dzisiejszego dziennika. Tej operacji nie można cofnąć."
          confirmLabel="Usuń"
          danger
          pending={pending}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => {
            void actionDeleteDeliveryReceipt(receipt.id)
              .then(onDeleted)
              .catch((err) => {
                onError(err instanceof Error ? err.message : "Nie udało się usunąć wpisu.");
              })
              .finally(() => setDeleteOpen(false));
          }}
        />
        <DeliveryJournalReceiptCard
        receipt={receipt}
        highlightQuery={highlightQuery}
        carrierCatalog={carriers}
        pendingCount={pendingCount}
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
                onClick={() => setDeleteOpen(true)}
              >
                Usuń
              </Button>
            </>
          ) : undefined
        }
      />
      </>
    );
  }

  return (
    <li className={journalEditShellClass}>
      <ReceiptFormFields
        form={form}
        setForm={setForm}
        suppliers={suppliers}
        carriers={carriers}
        formCarrier={formCarrier}
        disabled={pending}
        canManageCarriers={canManageCarriers}
        onManageCarriers={onManageCarriers}
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
  carriers,
  formCarrier,
  disabled,
  onSubmitShortcut,
  carrierHintLabel,
  supplierFieldKey,
  onManageCarriers,
  canManageCarriers = false,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  suppliers: SupplierOption[];
  carriers: WarehouseCarrierRow[];
  formCarrier: WarehouseCarrier;
  disabled?: boolean;
  onSubmitShortcut?: () => void;
  carrierHintLabel?: string | null;
  /** Remount typeahead — czyści tekst w polu po zapisie. */
  supplierFieldKey?: number;
  onManageCarriers?: () => void;
  canManageCarriers?: boolean;
}) {
  const showPallets = shipmentFormShowsPallets(form.shipmentForm);
  const showPackages = shipmentFormShowsPackages(form.shipmentForm);
  const carrierOptions = warehouseCarrierOptionsForSelect(carriers, formCarrier);

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
      <Field
        label={
          <span className="flex w-full items-center justify-between gap-2">
            <span>Kurier / sposób</span>
            {canManageCarriers ? (
              <button type="button" className={brandLinkClass} onClick={onManageCarriers}>
                Zarządzaj listą
              </button>
            ) : null}
          </span>
        }
      >
        <Select
          value={formCarrier}
          onChange={(e) =>
            setForm((f) => ({ ...f, carrier: e.target.value as WarehouseCarrier }))
          }
          disabled={disabled}
        >
          {carrierOptions.map((carrier) => (
            <option key={carrier.slug} value={carrier.slug}>
              {carrier.label}
              {!carrier.isActive ? " (ukryty)" : ""}
            </option>
          ))}
        </Select>
        {carrierHintLabel ? (
          <p className="mt-1.5 rounded-md border border-emerald-100 bg-emerald-50/80 px-2.5 py-1.5 text-[11px] leading-snug text-emerald-800">
            {carrierHintLabel}
          </p>
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
            min={1}
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
  carriers,
  initialJournal,
  todayDateKey,
  canEditJournal = false,
  canManageCarriers = false,
}: {
  suppliers: SupplierOption[];
  carriers: WarehouseCarrierRow[];
  initialJournal: {
    date: string;
    receipts: WarehouseDeliveryReceipt[];
    summary: { receiptCount: number; packageCount: number; palletCount: number };
    pendingBySupplier?: Record<string, number>;
  };
  todayDateKey: string;
  canEditJournal?: boolean;
  canManageCarriers?: boolean;
}) {
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const { readOnly: previewReadOnly, blockIfReadOnly } = usePreviewMutationBlocker(
    (text) => setToast({ text, tone: "error" })
  );
  const [pending, start] = useTransition();
  const [journal, setJournal] = useState(initialJournal);
  const pendingBySupplier = journal.pendingBySupplier ?? {};
  const [viewDate, setViewDate] = useState(initialJournal.date);
  const [subView, setSubView] = useState<JournalSubView>("entries");
  const [formOpen, setFormOpen] = useState(true);
  const canEditTodayEntries = canEditJournal;
  const isViewingToday = journal.date === todayDateKey;
  const [form, setForm] = useState<FormState>(() => createEmptyDeliveryJournalForm("inpost"));
  const [carrierHintLabel, setCarrierHintLabel] = useState<string | null>(null);
  const [carrierHintForSupplierId, setCarrierHintForSupplierId] = useState<string | null>(null);
  const [supplierFieldKey, setSupplierFieldKey] = useState(0);
  const [entrySearch, setEntrySearch] = useState("");
  const [archiveSearchSeed, setArchiveSearchSeed] = useState("");
  const [carriersModalOpen, setCarriersModalOpen] = useState(false);
  const [phonesModalOpen, setPhonesModalOpen] = useState(false);
  const formPanelRef = useRef<HTMLDivElement>(null);
  const hintCountsAppliedFor = useRef<string | null>(null);
  const defaultCarrier = useMemo(() => defaultWarehouseCarrierSlug(carriers), [carriers]);
  const formCarrier = resolveWarehouseFormCarrier(form.carrier, carriers, defaultCarrier);
  const visibleCarrierHint =
    form.supplierId && carrierHintForSupplierId === form.supplierId ? carrierHintLabel : null;

  const loadJournal = useCallback((dateKey: string) => {
    start(async () => {
      try {
        const next = await actionFetchDeliveryJournalForDate(dateKey);
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
  }, []);

  const refresh = useCallback(() => {
    loadJournal(viewDate);
  }, [viewDate, loadJournal]);

  const initialJournalKey = useMemo(
    () =>
      `${initialJournal.date}\0${initialJournal.receipts.map((receipt) => receipt.id).join("\0")}\0${initialJournal.summary.receiptCount}`,
    [initialJournal]
  );
  const [appliedJournalKey, setAppliedJournalKey] = useState(initialJournalKey);
  if (initialJournalKey !== appliedJournalKey) {
    setAppliedJournalKey(initialJournalKey);
    setJournal(initialJournal);
    setViewDate(initialJournal.date);
  }

  const carriersRef = useRef(carriers);
  useEffect(() => {
    carriersRef.current = carriers;
  }, [carriers]);
  const carriersCatalogKey = useMemo(
    () => carriers.map((carrier) => `${carrier.slug}:${carrier.isActive}:${carrier.label}`).join("\0"),
    [carriers]
  );
  const [appliedCarriersKey, setAppliedCarriersKey] = useState(carriersCatalogKey);
  if (carriersCatalogKey !== appliedCarriersKey) {
    setAppliedCarriersKey(carriersCatalogKey);
    setForm((current) => {
      const nextCarrier = resolveWarehouseFormCarrier(current.carrier, carriers, defaultCarrier);
      if (nextCarrier === current.carrier) return current;
      return { ...current, carrier: nextCarrier };
    });
  }

  const [formBootstrapped, setFormBootstrapped] = useState(false);
  if (!formBootstrapped && carriers.length > 0) {
    setFormBootstrapped(true);
    const bootCarrier = defaultWarehouseCarrierSlug(carriers);
    if (!form.supplierId && form.carrier === "inpost" && bootCarrier !== "inpost") {
      setForm((current) => ({ ...current, carrier: bootCarrier }));
    }
  }

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
      if (!carriersRef.current.some((carrier) => carrier.slug === hint.carrier)) {
        setCarrierHintForSupplierId(form.supplierId);
        setCarrierHintLabel(null);
        return;
      }
      const hintAlreadyApplied = hintCountsAppliedFor.current === form.supplierId;
      if (!hintAlreadyApplied) {
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
        hintCountsAppliedFor.current = form.supplierId;
      }
      const sourceLabel =
        hint.source === "default" ? "Z katalogu dostawcy" : "Z historii wpisów";
      setCarrierHintForSupplierId(form.supplierId);
      setCarrierHintLabel(
        `${sourceLabel}: ${warehouseCarrierLabel(hint.carrier, carriersRef.current)} · ${warehouseShipmentFormLabel(hint.shipmentForm)}`
      );
    });
    return () => {
      cancelled = true;
    };
  }, [form.supplierId, carriersCatalogKey]);

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
          carrier: resolveWarehouseFormCarrier(snapshot.carrier, carriers, defaultCarrier),
          shipmentForm: snapshot.shipmentForm,
          ...formCountsForSubmit(snapshot),
          note: snapshot.note,
        });
        setForm(formStateForNextEntry(snapshot));
        setCarrierHintLabel(null);
        setCarrierHintForSupplierId(null);
        hintCountsAppliedFor.current = null;
        setSupplierFieldKey((key) => key + 1);
        setFormOpen(true);
        setToast(WAREHOUSE_TOAST.savedDeliveryEntry);
        refresh();
        focusForm();
      } catch (e) {
        setToast({
          text: e instanceof Error ? e.message : "Błąd zapisu",
          tone: "error",
        });
      }
    });
  }, [carriers, blockIfReadOnly, defaultCarrier, form, pending, refresh, focusForm]);

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

  const formPanelWasOpen = useRef(false);
  useEffect(() => {
    if (formOpen && isViewingToday && !formPanelWasOpen.current) focusForm();
    formPanelWasOpen.current = formOpen;
  }, [formOpen, isViewingToday, focusForm]);

  const showEntries = subView === "entries";
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
              <p className={cn(panelTypography.sectionDesc, "mt-0.5")}>
                {isViewingToday ? (
                  <>
                    {formatTodayLabel(journal.date)} — {summaryLine}.
                    {canEditTodayEntries ? (
                      <>
                        {" "}
                        Skrót zapisu:{" "}
                        <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[10px]">
                          Ctrl
                        </kbd>
                        +
                        <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[10px]">
                          Enter
                        </kbd>
                        .
                      </>
                    ) : (
                      <> Podgląd — nie masz uprawnień do dodawania wpisów.</>
                    )}
                  </>
                ) : (
                  <>
                    Podgląd {formatTodayLabel(journal.date)} — {summaryLine}. Edycja tylko na
                    dzisiejszym dniu.
                  </>
                )}
              </p>
            ) : (
              <p className={cn(panelTypography.sectionDesc, "mt-0.5")}>
                Wyszukiwanie paczek, filtry i podsumowania — bez edycji wpisów.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showEntries ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPhonesModalOpen(true)}
              >
                <IconPhone size={15} className="mr-1.5" aria-hidden />
                Telefony kurierów
              </Button>
            ) : null}
            {showEntries && isViewingToday && canEditTodayEntries ? (
              <Button
                variant={formOpen ? "secondary" : "primary"}
                size="sm"
                disabled={pending}
                onClick={() => setFormOpen((open) => !open)}
              >
                {formOpen ? "Zwiń formularz" : "+ Dostawa"}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-3">
          <SegmentedControl<JournalSubView>
            ariaLabel="Widok dziennika dostaw"
            value={subView}
            onChange={setSubView}
            touchFriendly
            className="w-full sm:w-auto"
            options={[
              {
                value: "entries",
                label: "Dzień",
                title: "Wpisy z wybranej daty",
              },
              {
                value: "insights",
                label: "Archiwum",
                title: "Wyszukiwanie paczek i podsumowania",
              },
            ]}
          />
        </div>
      </div>

      {!showEntries ? (
        <DeliveryJournalInsightsPanel
          key={archiveSearchSeed || "default"}
          suppliers={suppliers}
          carriers={carriers}
          todayDateKey={todayDateKey}
          initialQuery={archiveSearchSeed}
        />
      ) : (
        <div className="space-y-4 px-4 py-5 sm:px-6">
          <div className={journalToolbarCardClass}>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[12.5rem] flex-1 sm:max-w-[17rem]">
                <span className={queueToolbarFieldLabelClass}>Data</span>
                <div className="mt-0.5 flex gap-1.5">
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
              </div>
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
          </div>

          {journal.summary.receiptCount > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <DaySummaryStat label="Dostawy" value={journal.summary.receiptCount} />
              <DaySummaryStat label="Paczki" value={journal.summary.packageCount} />
              <DaySummaryStat label="Palety" value={journal.summary.palletCount} />
              <DaySummaryStat
                label="Dostawcy"
                value={new Set(journal.receipts.map((r) => r.supplierId ?? r.supplierLabel)).size}
              />
            </div>
          ) : null}

          {formOpen && isViewingToday && canEditTodayEntries ? (
            <div
              ref={formPanelRef}
              className={cn(journalComposeShellClass, pending && "opacity-70")}
            >
              <p className={cn(panelTypography.sectionLabel, "mb-3")}>Nowa dostawa</p>
              <ReceiptFormFields
                form={form}
                setForm={setForm}
                suppliers={suppliers}
                carriers={carriers}
                formCarrier={formCarrier}
                disabled={pending}
                onSubmitShortcut={submitNew}
                carrierHintLabel={visibleCarrierHint}
                supplierFieldKey={supplierFieldKey}
                canManageCarriers={canManageCarriers}
                onManageCarriers={() => setCarriersModalOpen(true)}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                <Button variant="primary" size="sm" disabled={pending} onClick={submitNew}>
                  Zapisz i kolejna
                </Button>
                <span className="text-[11px] text-slate-500">Ctrl+Enter — zapisz bez myszy</span>
              </div>
            </div>
          ) : null}

          {journal.receipts.length > 0 ? (
            <div className={queueToolbarShellClass}>
              <DeliveryJournalSearchField
                id="journal-day-search"
                label="Szukaj w tym dniu"
                value={entrySearch}
                disabled={pending}
                placeholder="Nr listu, dostawca, kurier…"
                onChange={setEntrySearch}
              />
              {entrySearch.trim() ? (
                <p className={cn(panelTypography.caption, "px-0.5 sm:self-end")}>
                  {filteredReceipts.length} z {journal.receipts.length}{" "}
                  {journal.receipts.length === 1 ? "wpisu" : "wpisów"}
                </p>
              ) : (
                <p className={cn(panelTypography.caption, "px-0.5 sm:self-end")}>
                  Szukasz wcześniej?{" "}
                  <button type="button" className={brandLinkClass} onClick={() => goToArchive()}>
                    Archiwum
                  </button>
                </p>
              )}
            </div>
          ) : null}

          <ul className={cn("space-y-2", journal.receipts.length > 6 && QUEUE_LIST_BODY_CLASS)}>
            {filteredReceipts.map((r) => (
              <ReceiptRow
                key={r.id}
                receipt={r}
                suppliers={suppliers}
                carriers={carriers}
                pending={pending}
                readOnly={previewReadOnly || !isViewingToday}
                onSaved={refresh}
                onDeleted={refresh}
                onError={(text) => setToast({ text, tone: "error" })}
                highlightQuery={entrySearch.trim() || undefined}
                canManageCarriers={canManageCarriers}
                onManageCarriers={() => setCarriersModalOpen(true)}
                pendingCount={r.supplierId ? pendingBySupplier[r.supplierId] : undefined}
              />
            ))}
          </ul>

          {!filteredReceipts.length && journal.receipts.length > 0 && entrySearch.trim() ? (
            <EmptyState
              title="Brak wyników na ten dzień"
              description="Spróbuj innej frazy albo przeszukaj wcześniejsze dni w Archiwum."
              action={
                <Button variant="secondary" size="sm" onClick={() => goToArchive(entrySearch)}>
                  Szukaj w Archiwum
                </Button>
              }
            />
          ) : null}

          {!journal.receipts.length && (!formOpen || !isViewingToday || !canEditTodayEntries) ? (
            <EmptyState
              title={isViewingToday ? "Brak wpisów na dziś" : "Brak wpisów w tym dniu"}
              description={
                isViewingToday
                  ? canEditTodayEntries
                    ? "Dodaj pierwszą dostawę przyciskiem „+ Dostawa”."
                    : "Dostawy można dodawać w zakładce Dzień."
                  : "Wybierz inną datę lub wróć na dziś."
              }
              action={
                isViewingToday && canEditTodayEntries && !formOpen ? (
                  <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
                    + Dostawa
                  </Button>
                ) : undefined
              }
            />
          ) : null}
        </div>
      )}

      {toast ? <NoticeToast notice={toast} onDismiss={() => setToast(null)} /> : null}
      {canManageCarriers ? (
        <WarehouseCarriersModal
          open={carriersModalOpen}
          onClose={() => setCarriersModalOpen(false)}
          initial={carriers}
        />
      ) : null}
      <CarrierPhonesModal
        open={phonesModalOpen}
        onClose={() => setPhonesModalOpen(false)}
        carriers={carriers}
      />
    </section>
  );
}
