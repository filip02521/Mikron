"use client";

import { useState, useTransition, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { IndividualOrder, IndividualRequestKind } from "@/types/database";
import {
  emptyVerificationForm,
  orderToVerificationForm,
  shouldLookupSupplierFromCatalog,
  type VerificationSupplierOption,
} from "@/lib/orders/verification-form";
import {
  actionCancelVerification,
  actionCompleteVerification,
} from "@/app/actions/admin";
import { useAdminPanelPreview } from "@/components/layout/AdminPanelPreviewContext";
import { ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED } from "@/lib/auth/admin-panel-preview-messages";
import { actionLookupSupplierFromCatalogTwId } from "@/app/actions/subiekt";
import { assessRequestCompleteness } from "@/lib/orders/request-completeness";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionListLabel } from "@/components/ui/SectionListLabel";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconClipboardPen } from "@/components/icons/StrokeIcons";
import { VerificationHelp } from "@/components/verification/VerificationHelp";
import {
  VerificationQueuePicker,
  type VerificationQueueItemMeta,
} from "@/components/verification/VerificationQueuePicker";
import { formatPlDate } from "@/lib/display-labels";
import { verificationDraftMissingLabels, verificationQueueMissingLabels } from "@/lib/orders/verification-gaps";
import {
  resolveVerificationInformacjaFlags,
  verificationInformacjaUiForDraft,
  verificationInformacjaUiForOrder,
} from "@/lib/orders/verification-informacja-ui";
import {
  informacjaFlowPathFromOrder,
} from "@/lib/orders/informacja-stock-out-reorder";
import { VerificationInformacjaPathPanel, VerificationPathBadge } from "@/components/verification/VerificationInformacjaPathPanel";
import { ProsbaFormSection } from "@/components/orders/ProsbaFormSection";
import { ProsbaFormReadiness } from "@/components/orders/ProsbaFormReadiness";
import {
  ProsbaFormKeyboardStrip,
  ProsbaFormProductsSection,
  ProsbaFormRequestKindSection,
} from "@/components/orders/ProsbaFormSharedSections";
import { PROSBA_FORM_SECTION_COPY } from "@/lib/orders/prosba-form-section-copy";
import { buildProsbaFormReadinessWithSupplier } from "@/lib/orders/prosba-form-readiness";
import { IconUserGroup } from "@/components/icons/StrokeIcons";
import { MyOrderAssignedClient } from "@/components/moje/MyOrderAssignedClient";
import { normalizeSalesClientName } from "@/lib/orders/sales-client-label";
import { normalizeSalesRequestNote } from "@/lib/orders/sales-request-note";
import { ProcurementSalesRequestNote } from "@/components/orders/ProcurementSalesRequestNote";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { SupplierPickerField } from "@/components/orders/SupplierPickerField";
import { SubiektProductLineFields } from "@/components/subiekt/SubiektProductLineFields";
import { ProsbaStockConfirmDialog } from "@/components/orders/ProsbaStockConfirmDialog";
import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import { buildProsbaSubmitStockConfirm } from "@/lib/orders/prosba-stock-check";
import { handleProsbaStockSubmitError } from "@/lib/orders/prosba-stock-submit-error";
import { useProsbaLinesStockSync } from "@/hooks/useProsbaLinesStockSync";
import { useTeethExemptTwIds, useTeethProductInfo } from "@/components/layout/TeethExemptContext";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { toAppSupplierRefs } from "@/lib/subiekt/match-supplier";
import {
  assessProsbaLineFields,
  shouldShowProsbaLineFieldValidation,
} from "@/lib/orders/prosba-line-field-validation";
import {
  handleProcurementProsbaKeyboardEvent,
  PROCUREMENT_PROSBA_KEYBOARD_HINTS,
} from "@/lib/orders/procurement-prosba-keyboard";
import { panelPageShellClass, panelSectionInsetClass, panelTypography } from "@/lib/ui/ontime-theme";
import { ProcurementCancelDialog } from "@/components/procurement/ProcurementCancelDialog";
import { cn } from "@/lib/cn";
import { SALES_PAGE_HEADER_HINTS } from "@/lib/sales/sales-page-ui-copy";

export function VerificationWorkspace({
  orders,
  suppliers,
  salesPeople,
  onQueueEmpty,
  layout = "page",
}: {
  orders: IndividualOrder[];
  suppliers: VerificationSupplierOption[];
  salesPeople: { id: string; name: string }[];
  onQueueEmpty?: () => void;
  layout?: "page" | "modal";
}) {
  const inModal = layout === "modal";
  const router = useRouter();
  const { readOnly } = useAdminPanelPreview();
  const teethExemptTwIds = useTeethExemptTwIds();
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const [activeId, setActiveId] = useState<string | null>(orders[0]?.id ?? null);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const resolvedActiveId = useMemo(() => {
    if (!orders.length) return null;
    if (orders.some((order) => order.id === activeId)) return activeId;
    return orders[0]?.id ?? null;
  }, [orders, activeId]);

  useEffect(() => {
    if (!orders.length) onQueueEmpty?.();
  }, [orders.length, onQueueEmpty]);

  const active = orders.find((order) => order.id === resolvedActiveId) ?? null;
  const teethProductInfo = useTeethProductInfo();
  const cancelTargetOrder = useMemo(
    () => orders.find((order) => order.id === cancelTargetId) ?? null,
    [orders, cancelTargetId]
  );
  const activeRequestNote = active
    ? normalizeSalesRequestNote(active.sales_request_note)
    : null;

  const [supplierSubiektFeedback, setSupplierSubiektFeedback] =
    useState<SubiektFeedback | null>(null);
  const [resolvingSupplier, setResolvingSupplier] = useState(false);
  const [stockConfirmOpen, setStockConfirmOpen] = useState(false);
  const [stockConfirmMessage, setStockConfirmMessage] = useState("");

  const supplierRefs = useMemo(() => toAppSupplierRefs(suppliers), [suppliers]);

  const [form, setForm] = useState(() => {
    if (!orders[0]) return emptyVerificationForm();
    const f = orderToVerificationForm(orders[0]);
    const twId = orders[0].subiekt_tw_id;
    if (twId && twId > 0 && teethProductInfo.twIds.has(twId)) {
      f.teethManufacturer = teethProductInfo.manufacturerByTwId.get(twId) ?? null;
      f.teethKind = teethProductInfo.kindByTwId.get(twId) ?? null;
    }
    return f;
  });
  const [loadedOrderId, setLoadedOrderId] = useState<string | null>(null);

  if (resolvedActiveId && resolvedActiveId !== loadedOrderId) {
    setLoadedOrderId(resolvedActiveId);
    const order = orders.find((item) => item.id === resolvedActiveId);
    if (order) {
      setValidationAttempted(false);
      setSupplierSubiektFeedback(null);
      setResolvingSupplier(shouldLookupSupplierFromCatalog(order));
      const f = orderToVerificationForm(order);
      const twId = order.subiekt_tw_id;
      if (twId && twId > 0 && teethProductInfo.twIds.has(twId)) {
        f.teethManufacturer = teethProductInfo.manufacturerByTwId.get(twId) ?? null;
        f.teethKind = teethProductInfo.kindByTwId.get(twId) ?? null;
      }
      setForm(f);
    }
  }

  useEffect(() => {
    if (!loadedOrderId) return;
    const order = orders.find((item) => item.id === loadedOrderId);
    if (!order || !shouldLookupSupplierFromCatalog(order)) return;

    const twId = order.subiekt_tw_id!;
    let cancelled = false;

    void actionLookupSupplierFromCatalogTwId(twId, supplierRefs).then((res) => {
      if (cancelled) return;
      setResolvingSupplier(false);
      if (res.ok) {
        setForm((currentForm) => ({ ...currentForm, supplierId: res.supplierId }));
        setSupplierSubiektFeedback(null);
      } else {
        setSupplierSubiektFeedback(res.feedback);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadedOrderId, orders, supplierRefs]);

  const informacjaFlags = useMemo(
    () =>
      form.requestKind === "informacja" && active
        ? resolveVerificationInformacjaFlags({
            requestKind: "informacja",
            informacjaPath: form.informacjaPath,
            priorOrder: active,
          })
        : {
            informacjaQueueViaDailyPanel: false,
            informacjaStockOutReorder: false,
          },
    [active, form.informacjaPath, form.requestKind]
  );

  const draft = useMemo(
    () => ({
      supplierId: form.supplierId,
      symbol: form.symbol,
      mikranCode: form.mikranCode,
      product: form.product,
      quantity: form.quantity,
      requestKind: form.requestKind,
      ...informacjaFlags,
    }),
    [
      form.mikranCode,
      form.product,
      form.quantity,
      form.requestKind,
      form.supplierId,
      form.symbol,
      informacjaFlags,
    ]
  );
  const assessment = assessRequestCompleteness(draft);

  const verificationReadiness = useMemo(
    () =>
      buildProsbaFormReadinessWithSupplier(
        [
          {
            symbol: form.symbol,
            mikranCode: form.mikranCode,
            product: form.product,
            quantity: form.quantity,
            supplierId: form.supplierId,
            subiektTwId: form.subiektTwId,
          },
        ],
        form.supplierId,
        form.requestKind,
        {
          informacjaPath: form.informacjaPath ?? "direct",
          resolvingSupplier,
        }
      ),
    [
      form.symbol,
      form.mikranCode,
      form.product,
      form.quantity,
      form.supplierId,
      form.subiektTwId,
      form.requestKind,
      form.informacjaPath,
      resolvingSupplier,
    ]
  );

  const readinessFormMessage = useMemo(() => {
    if (supplierSubiektFeedback?.message) {
      return {
        text: supplierSubiektFeedback.message,
        tone:
          supplierSubiektFeedback.tone === "error"
            ? ("error" as const)
            : ("warning" as const),
      };
    }
    return null;
  }, [supplierSubiektFeedback]);

  const setVerificationRequestKind = useCallback(
    (requestKind: IndividualRequestKind) => {
      if (
        requestKind === "zamowienie" &&
        active &&
        verificationInformacjaUiForOrder(active)?.pathLocked
      ) {
        const label =
          verificationInformacjaUiForOrder(active)?.badgeLabel ?? "informacja";
        if (
          !confirm(
            `Handlowiec zgłosił „${label}”. Zmiana na zamówienie u dostawcy usunie tę ścieżkę. Kontynuować?`
          )
        ) {
          return;
        }
      }
      setForm((f) => ({
        ...f,
        requestKind,
        quantity: requestKind === "informacja" ? "" : f.quantity,
        informacjaPath:
          requestKind === "informacja"
            ? (f.informacjaPath ??
              (active ? (informacjaFlowPathFromOrder(active) ?? "direct") : "direct"))
            : null,
      }));
    },
    [active]
  );

  const informacjaUi = verificationInformacjaUiForDraft({
    requestKind: form.requestKind,
    informacjaPath: form.informacjaPath,
    sourceOrder: active,
  });

  const lineDraft = {
    id: active?.id ?? "verification-line",
    symbol: form.symbol,
    mikranCode: form.mikranCode,
    product: form.product,
    quantity: form.quantity,
    subiektTwId: form.subiektTwId,
  };
  const showFieldValidation = shouldShowProsbaLineFieldValidation(lineDraft, {
    active: true,
    validationAttempted,
    lineCount: 1,
    requestKind: form.requestKind,
  });
  const fieldValidation = showFieldValidation
    ? assessProsbaLineFields(
        lineDraft,
        form.requestKind,
        validationAttempted ? "strict" : "soft"
      )
    : undefined;

  const verificationProductLines = useMemo((): ProductLineDraft[] => {
    if (!loadedOrderId) return [];
    return [
      {
        id: loadedOrderId,
        symbol: form.symbol,
        mikranCode: form.mikranCode,
        product: form.product,
        quantity: form.quantity,
        subiektTwId: form.subiektTwId,
        onHand: form.onHand,
        reserved: form.reserved,
        available: form.available,
        stockSource: form.stockSource,
      },
    ];
  }, [loadedOrderId, form]);

  useProsbaLinesStockSync(
    verificationProductLines,
    (lines) => {
      const line = lines[0];
      if (!line) return;
      setForm((current) => ({
        ...current,
        onHand: line.onHand,
        reserved: line.reserved,
        available: line.available,
        stockSource: line.stockSource,
      }));
    },
    form.requestKind,
    form.requestKind === "zamowienie",
    teethExemptTwIds
  );

  const performSave = (options?: { acknowledgeSufficientStock?: boolean }) => {
    if (!active) return;
    setPendingMessage("Zapisywanie i przekazywanie do panelu…");
    start(async () => {
      try {
        await actionCompleteVerification(active.id, {
          supplierId: form.supplierId,
          salesPersonId: form.salesPersonId,
          symbol: form.symbol,
          mikranCode: form.mikranCode,
          product: form.product,
          quantity: form.requestKind === "informacja" ? undefined : form.quantity,
          requestKind: form.requestKind,
          subiektTwId: form.subiektTwId,
          onHand: form.onHand,
          reserved: form.reserved,
          available: form.available,
          stockSource: form.stockSource,
          informacjaPath:
            form.requestKind === "informacja" && form.informacjaPath
              ? form.informacjaPath
              : undefined,
          acknowledgeSufficientStock: options?.acknowledgeSufficientStock,
          teethDetails: form.teethDetails ?? null,
        });
        setToast({
          text:
            informacjaUi?.completeSuccessMessage ??
            "Uzupełniono — prośba trafiła do panelu dziennego jako „Nowe”.",
          tone: "success",
        });
        setStockConfirmOpen(false);
        router.refresh();
      } catch (e) {
        handleProsbaStockSubmitError(
          e,
          (message) => {
            setStockConfirmMessage(message);
            setStockConfirmOpen(true);
          },
          (message) => {
            setToast({ text: message, tone: "error" });
          }
        );
      } finally {
        setPendingMessage(null);
      }
    });
  };

  const saveRef = useRef<() => void>(() => {});

  const save = () => {
    if (!active) return;
    if (readOnly) {
      setToast({ text: ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED, tone: "error" });
      return;
    }
    setValidationAttempted(true);
    if (assessment !== "complete") {
      setToast({
        text:
          form.requestKind === "zamowienie"
            ? "Uzupełnij dostawcę, opis produktu i ilość (np. 1), aby zatwierdzić."
            : "Uzupełnij dostawcę oraz opis produktu, aby zatwierdzić.",
        tone: "error",
      });
      return;
    }
    const stockConfirm = buildProsbaSubmitStockConfirm(
      verificationProductLines,
      form.requestKind,
      teethExemptTwIds
    );
    if (stockConfirm) {
      setStockConfirmMessage(stockConfirm.message);
      setStockConfirmOpen(true);
      return;
    }
    performSave();
  };
  useEffect(() => {
    saveRef.current = save;
  });

  const queueItems = useMemo((): VerificationQueueItemMeta[] => {
    return orders.map((o) => {
      const missing =
        o.id === resolvedActiveId
          ? verificationDraftMissingLabels(draft)
          : verificationQueueMissingLabels(o);
      const pathUi = verificationInformacjaUiForOrder(o);
      const supplierLabel =
        o.id === resolvedActiveId && form.supplierId
          ? (suppliers.find((s) => s.id === form.supplierId)?.name ??
            o.supplier?.name ??
            "Brak dostawcy")
          : (o.supplier?.name ?? "Brak dostawcy");
      return {
        id: o.id,
        order: o,
        supplierLabel,
        missing,
        ready: missing.length === 0,
        pathUi,
      };
    });
  }, [orders, resolvedActiveId, draft, form.supplierId, suppliers]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      handleProcurementProsbaKeyboardEvent(e, {
        pending,
        onSubmit: () => saveRef.current(),
        onSetRequestKind: setVerificationRequestKind,
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, setVerificationRequestKind]);

  const cancel = (id: string) => {
    if (readOnly) {
      setToast({ text: ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED, tone: "error" });
      return;
    }
    setCancelTargetId(id);
  };

  const confirmCancel = (note: string | undefined) => {
    if (!cancelTargetId) return;
    const id = cancelTargetId;
    setPendingMessage("Anulowanie prośby…");
    start(async () => {
      try {
        const result = await actionCancelVerification(id, note);
        const emailSuffix = result.emailError ? ` (${result.emailError})` : "";
        setToast({
          text: `Prośba anulowana.${emailSuffix}`,
          tone: result.emailError ? "error" : "success",
        });
        router.refresh();
      } catch (e) {
        setToast({
          text: e instanceof Error ? e.message : "Błąd",
          tone: "error",
        });
      } finally {
        setPendingMessage(null);
        setCancelTargetId(null);
      }
    });
  };

  const workspaceBody =
    !orders.length ? (
      <EmptyState
        title="Brak pozycji do weryfikacji"
        description="Niekompletne zgłoszenia handlowców pojawią się tutaj."
      />
    ) : (
      <div
        className={
          inModal
            ? "flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,0.4fr)_minmax(0,1fr)] lg:divide-x lg:divide-slate-100"
            : "flex flex-col"
        }
      >
        <VerificationQueuePicker
          items={queueItems}
          activeId={activeId}
          onSelect={setActiveId}
          layout={inModal ? "modal" : "page"}
        />

        {active ? (
          <div
            className={
              inModal
                ? "flex min-h-0 min-w-0 flex-1 flex-col lg:min-h-0"
                : "flex min-w-0 flex-col border-t border-slate-200/90 bg-white"
            }
          >
            {inModal ? (
              <SectionListLabel
                domain="panel"
                title="Uzupełnij dane"
                hint={`Zgłoszenie od ${active.sales_person?.name ?? "handlowca"}`}
                hintMode="tooltip"
                icon={<IconClipboardPen size={17} />}
                tileClassName="bg-amber-100 text-amber-800"
              />
            ) : (
              <div className="border-b border-slate-100 bg-slate-50/40 px-3 py-3 sm:px-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={panelTypography.sectionLabel}>Uzupełnianie prośby</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">
                      {active.sales_person?.name ?? "Handlowiec"}
                    </p>
                    <p className={cn("mt-0.5", panelTypography.sectionDesc)}>
                      {formatPlDate(active.action_at.slice(0, 10))}
                      {informacjaUi ? ` · ${informacjaUi.badgeLabel}` : ""}
                    </p>
                  </div>
                  {informacjaUi ? (
                    <VerificationPathBadge ui={informacjaUi} className="shrink-0 text-[10px]" />
                  ) : null}
                </div>
                {normalizeSalesClientName(active.sales_client_name) ? (
                  <MyOrderAssignedClient
                    name={normalizeSalesClientName(active.sales_client_name)!}
                    className="mt-2"
                  />
                ) : null}
                {activeRequestNote ? (
                  <ProcurementSalesRequestNote note={activeRequestNote} className="mt-2" />
                ) : null}
              </div>
            )}

            <div
              className={
                inModal
                  ? cn(
                      "min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain lg:overflow-y-auto",
                      panelSectionInsetClass
                    )
                  : cn("space-y-4", panelSectionInsetClass, "pb-2")
              }
            >
              <ProsbaFormKeyboardStrip
                hints={PROCUREMENT_PROSBA_KEYBOARD_HINTS.filter((h) => h.keys[0] !== "+")}
                variant="procurement"
              />

              <ProsbaFormRequestKindSection
                value={form.requestKind}
                disabled={pending}
                onChange={setVerificationRequestKind}
              />

              {form.requestKind === "informacja" && informacjaUi && form.informacjaPath ? (
                <VerificationInformacjaPathPanel
                  ui={informacjaUi}
                  path={form.informacjaPath}
                  onPathChange={(informacjaPath) =>
                    setForm((f) => ({ ...f, informacjaPath }))
                  }
                />
              ) : null}

              <ProsbaFormSection
                title={PROSBA_FORM_SECTION_COPY.delegateProcurement.title}
                hint={PROSBA_FORM_SECTION_COPY.delegateProcurement.hint}
                accent="indigo"
                icon={<IconUserGroup size={17} />}
                tileClassName="bg-indigo-100 text-indigo-800"
              >
                <div
                  className={cn(
                    "grid gap-4 sm:items-start",
                    inModal ? "sm:grid-cols-2" : "grid-cols-1"
                  )}
                >
                  <Field labelClassName="inline-flex min-h-6 items-center" label="Dla kogo (handlowiec)">
                    <Select
                      value={form.salesPersonId}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, salesPersonId: e.target.value }))
                      }
                    >
                      {salesPeople.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field labelClassName="inline-flex min-h-6 items-center" label="Dostawca">
                    <SupplierPickerField
                      suppliers={suppliers}
                      value={form.supplierId}
                      onChange={(supplierId) => {
                        setSupplierSubiektFeedback(null);
                        setForm((f) => ({ ...f, supplierId }));
                      }}
                      allowEmpty={false}
                      emptyLabel="Wybierz dostawcę"
                      showInlineFeedback
                      dropdownSize="default"
                    />
                  </Field>
                </div>
                {inModal && normalizeSalesClientName(active.sales_client_name) ? (
                  <MyOrderAssignedClient
                    name={normalizeSalesClientName(active.sales_client_name)!}
                    className="mt-3"
                  />
                ) : null}
                {inModal && activeRequestNote ? (
                  <ProcurementSalesRequestNote note={activeRequestNote} className="mt-3" />
                ) : null}
              </ProsbaFormSection>

              <ProsbaFormProductsSection
                requestKind={form.requestKind}
                informacjaPath={form.informacjaPath ?? "direct"}
                hint={
                  form.subiektTwId
                    ? "Towar z Subiekta — wyszukaj inną pozycję: nazwa lub symbol w dużym polu, kod Mikran obok."
                    : form.requestKind === "informacja"
                      ? (informacjaUi?.productSectionHint ??
                        "Wystarczy nazwa lub symbol produktu — bez ilości.")
                      : PROSBA_FORM_SECTION_COPY.products.orderHint
                }
              >
                <div className="space-y-3">
                  <SubiektProductLineFields
                    appearance="prosba"
                    requestKind={form.requestKind}
                    suppliers={supplierRefs}
                    delegateAlerts
                    compactControls
                    typeaheadSize="default"
                    fieldValidation={fieldValidation}
                    onSupplierResolved={({ supplierId }) => {
                      setSupplierSubiektFeedback(null);
                      setForm((f) => ({ ...f, supplierId }));
                    }}
                    onSupplierMappingMissing={() =>
                      setForm((f) => ({ ...f, supplierId: "" }))
                    }
                    onSupplierResolveFeedback={setSupplierSubiektFeedback}
                    onResolvingSupplierChange={setResolvingSupplier}
                    value={{
                      symbol: form.symbol,
                      mikranCode: form.mikranCode,
                      product: form.product,
                      quantity: form.quantity,
                      subiektTwId: form.subiektTwId,
                      onHand: form.onHand,
                      reserved: form.reserved,
                      available: form.available,
                      stockSource: form.stockSource,
                      teethManufacturer: form.teethManufacturer ?? null,
                      teethKind: form.teethKind ?? null,
                      teethDetails: form.teethDetails ?? undefined,
                    }}
                    onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                  />

                  <ProsbaFormReadiness
                    lines={[
                      {
                        symbol: form.symbol,
                        mikranCode: form.mikranCode,
                        product: form.product,
                        quantity: form.quantity,
                        supplierId: form.supplierId,
                        subiektTwId: form.subiektTwId,
                      },
                    ]}
                    requestKind={form.requestKind}
                    salesSubmitPlan={verificationReadiness.plan}
                    formMessage={readinessFormMessage}
                    informacjaPath={form.informacjaPath ?? "direct"}
                    resolvingSupplier={resolvingSupplier}
                    validationAttempted={validationAttempted}
                  />
                </div>
              </ProsbaFormProductsSection>
            </div>

            <div
              className={cn(
                "flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white px-3 py-3 sm:px-4 lg:px-5",
                !inModal &&
                  "sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-10 bg-white/95 shadow-[0_-4px_16px_-8px_rgba(15,23,42,0.12)] backdrop-blur-sm md:bottom-0"
              )}
            >
              <Button
                disabled={pending || assessment !== "complete"}
                onClick={save}
              >
                Zatwierdź i prześlij do panelu
              </Button>
              <Button
                variant="ghost"
                className="text-red-700"
                disabled={pending}
                onClick={() => cancel(active.id)}
              >
                Anuluj prośbę
              </Button>
              {!inModal && assessment === "complete" ? (
                <span className="ml-auto text-xs font-medium text-emerald-700">
                  Gotowe do zatwierdzenia
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    );

  return (
    <>
      <ProsbaStockConfirmDialog
        open={stockConfirmOpen}
        message={stockConfirmMessage}
        pending={pending}
        onCancel={() => setStockConfirmOpen(false)}
        onConfirm={() => performSave({ acknowledgeSufficientStock: true })}
      />
    <div
      className={
        inModal
          ? "relative flex min-h-0 flex-1 flex-col"
          : panelPageShellClass
      }
    >
      {pendingMessage ? (
        <ActionLoadingOverlay
          message={pendingMessage}
          variant={inModal ? "modal" : "viewport"}
        />
      ) : null}
      {toast ? (
        <Toast message={toast.text} tone={toast.tone} onDismiss={() => setToast(null)} />
      ) : null}
      <ProcurementCancelDialog
        open={cancelTargetId !== null}
        title="Anulować prośbę?"
        headline={cancelTargetOrder?.products}
        message="Prośba zostanie oznaczona jako anulowana i zniknie z kolejki weryfikacji."
        confirmLabel="Anuluj prośbę"
        tier={inModal ? "stack" : "raised"}
        pending={pending && cancelTargetId !== null}
        onCancel={() => setCancelTargetId(null)}
        onConfirm={confirmCancel}
      />

      {inModal ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-amber-100 bg-white">
          {workspaceBody}
        </div>
      ) : (
        <Card padding={false} className="overflow-hidden">
          <CardHeader
            inset
            density="compact"
            leading={
              <SectionHeadingIcon tileClassName="bg-amber-100 text-amber-800">
                <IconClipboardPen size={20} />
              </SectionHeadingIcon>
            }
            title="Weryfikacja zgłoszeń"
            hint={SALES_PAGE_HEADER_HINTS.verification}
            hintAriaLabel="O weryfikacji zgłoszeń"
            action={<VerificationHelp />}
          />
          {workspaceBody}
        </Card>
      )}
    </div>
    </>
  );
}
