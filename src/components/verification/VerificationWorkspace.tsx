"use client";

import { useState, useTransition, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import type { IndividualOrder } from "@/types/database";
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
import {
  VerificationInformacjaPathPanel,
  VerificationPathBadge,
} from "@/components/verification/VerificationInformacjaPathPanel";
import { RequestFormStatusPanel } from "@/components/orders/RequestFormStatusPanel";
import { ProsbaFormSection } from "@/components/orders/ProsbaFormSection";
import { MyOrderAssignedClient } from "@/components/moje/MyOrderAssignedClient";
import { normalizeSalesClientName } from "@/lib/orders/sales-client-label";
import { normalizeSalesRequestNote } from "@/lib/orders/sales-request-note";
import { ProcurementSalesRequestNote } from "@/components/orders/ProcurementSalesRequestNote";
import { RequestKindToggle } from "@/components/orders/RequestKindToggle";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { SupplierPickerField } from "@/components/orders/SupplierPickerField";
import { SubiektProductLineFields } from "@/components/subiekt/SubiektProductLineFields";
import { KeyboardShortcutsHint } from "@/components/ui/KeyboardShortcutsHint";
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
import { cn } from "@/lib/cn";

const VERIFICATION_INTRO =
  "Niekompletne prośby handlowców — uzupełnij dostawcę i produkt. Po zatwierdzeniu trafiają do panelu dziennego; ścieżka informacji (dostępność / brak na stanie) jest zachowana.";

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
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const [activeId, setActiveId] = useState<string | null>(orders[0]?.id ?? null);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const resolvedActiveId = useMemo(() => {
    if (!orders.length) return null;
    if (orders.some((order) => order.id === activeId)) return activeId;
    return orders[0]?.id ?? null;
  }, [orders, activeId]);

  useEffect(() => {
    if (!orders.length) onQueueEmpty?.();
  }, [orders.length, onQueueEmpty]);

  const active = orders.find((order) => order.id === resolvedActiveId) ?? null;
  const activeRequestNote = active
    ? normalizeSalesRequestNote(active.sales_request_note)
    : null;

  const [supplierSubiektFeedback, setSupplierSubiektFeedback] =
    useState<SubiektFeedback | null>(null);
  const [supplierPickerFeedbacks, setSupplierPickerFeedbacks] = useState<SubiektFeedback[]>(
    []
  );
  const [productLineFeedback, setProductLineFeedback] = useState<SubiektFeedback | null>(
    null
  );
  const [configFeedback, setConfigFeedback] = useState<SubiektFeedback | null>(null);
  const [resolvingSupplier, setResolvingSupplier] = useState(false);

  const supplierRefs = useMemo(() => toAppSupplierRefs(suppliers), [suppliers]);

  const [form, setForm] = useState(() =>
    orders[0] ? orderToVerificationForm(orders[0]) : emptyVerificationForm()
  );
  const [loadedOrderId, setLoadedOrderId] = useState<string | null>(null);

  if (resolvedActiveId && resolvedActiveId !== loadedOrderId) {
    setLoadedOrderId(resolvedActiveId);
    const order = orders.find((item) => item.id === resolvedActiveId);
    if (order) {
      setValidationAttempted(false);
      setSupplierSubiektFeedback(null);
      setSupplierPickerFeedbacks([]);
      setProductLineFeedback(null);
      setConfigFeedback(null);
      setResolvingSupplier(shouldLookupSupplierFromCatalog(order));
      setForm(orderToVerificationForm(order));
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
          informacjaPath:
            form.requestKind === "informacja" && form.informacjaPath
              ? form.informacjaPath
              : undefined,
        });
        setToast({
          text:
            informacjaUi?.completeSuccessMessage ??
            "Uzupełniono — prośba trafiła do panelu dziennego jako „Nowe”.",
          tone: "success",
        });
        router.refresh();
      } catch (e) {
        setToast({
          text: e instanceof Error ? e.message : "Nie udało się zapisać",
          tone: "error",
        });
      } finally {
        setPendingMessage(null);
      }
    });
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
        onSetRequestKind: (kind) =>
          setForm((f) => ({
            ...f,
            requestKind: kind,
            quantity: kind === "informacja" ? "" : f.quantity,
            informacjaPath:
              kind === "informacja"
                ? (f.informacjaPath ??
                  (active ? (informacjaFlowPathFromOrder(active) ?? "direct") : "direct"))
                : null,
          })),
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, active]);

  const cancel = (id: string) => {
    if (readOnly) {
      setToast({ text: ADMIN_PANEL_PREVIEW_MUTATION_BLOCKED, tone: "error" });
      return;
    }
    if (!confirm("Anulować tę prośbę?")) return;
    setPendingMessage("Anulowanie prośby…");
    start(async () => {
      try {
        await actionCancelVerification(id);
        setToast({ text: "Prośba anulowana.", tone: "success" });
        router.refresh();
      } catch (e) {
        setToast({
          text: e instanceof Error ? e.message : "Błąd",
          tone: "error",
        });
      } finally {
        setPendingMessage(null);
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
              <details className="rounded-md border border-slate-100 bg-slate-50/70 open:shadow-sm">
                <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-slate-600 marker:content-none [&::-webkit-details-marker]:hidden">
                  Skróty klawiszowe
                </summary>
                <div className="border-t border-slate-100 px-3 pb-2.5 pt-2">
                  <KeyboardShortcutsHint
                    items={PROCUREMENT_PROSBA_KEYBOARD_HINTS.filter(
                      (h) => h.keys[0] !== "+"
                    )}
                    compact
                  />
                </div>
              </details>

              <ProsbaFormSection
                domain="panel"
                title="Co chcesz zgłosić?"
                hint="Rodzaj prośby decyduje o wymaganych polach produktu."
              >
                <RequestKindToggle
                  value={form.requestKind}
                  onChange={(requestKind) => {
                    if (
                      requestKind === "zamowienie" &&
                      active &&
                      verificationInformacjaUiForOrder(active)?.pathLocked
                    ) {
                      const label =
                        verificationInformacjaUiForOrder(active)?.badgeLabel ??
                        "informacja";
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
                            (active
                              ? (informacjaFlowPathFromOrder(active) ?? "direct")
                              : "direct"))
                          : null,
                    }));
                  }}
                />
              </ProsbaFormSection>

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
                domain="panel"
                title="Dla kogo i u kogo?"
                hint="Handlowiec oraz dostawca przypisany do prośby."
              >
                <div
                  className={cn(
                    "grid gap-4",
                    inModal ? "sm:grid-cols-2" : "grid-cols-1"
                  )}
                >
                  <Field label="Dostawca">
                    <SupplierPickerField
                      suppliers={suppliers}
                      value={form.supplierId}
                      onChange={(supplierId) =>
                        setForm((f) => ({ ...f, supplierId }))
                      }
                      allowEmpty={false}
                      emptyLabel="Wybierz dostawcę"
                      showInlineFeedback={false}
                      dropdownSize="default"
                      onSubiektFeedbackChange={setSupplierPickerFeedbacks}
                    />
                  </Field>
                  <Field label="Handlowiec">
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

              <ProsbaFormSection
                domain="panel"
                title="Produkt"
                hint={
                  form.subiektTwId
                    ? "Towar z Subiekta — wyszukaj inną pozycję: nazwa lub symbol w dużym polu, kod Mikran obok."
                    : form.requestKind === "informacja"
                      ? (informacjaUi?.productSectionHint ??
                        "Wystarczy nazwa lub symbol produktu — bez ilości.")
                      : "Podaj nazwę lub symbol oraz ilość."
                }
              >
                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
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
                    onProductFeedbackChange={setProductLineFeedback}
                    onConfigFeedbackChange={setConfigFeedback}
                    onResolvingSupplierChange={setResolvingSupplier}
                    value={{
                      symbol: form.symbol,
                      mikranCode: form.mikranCode,
                      product: form.product,
                      quantity: form.quantity,
                      subiektTwId: form.subiektTwId,
                    }}
                    onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                  />
                </div>
              </ProsbaFormSection>

              <RequestFormStatusPanel
                audience="procurement"
                requestKind={form.requestKind}
                draft={draft}
                forcedAssessment={assessment}
                validationAttempted={validationAttempted}
                subiektFeedbacks={[
                  configFeedback,
                  ...supplierPickerFeedbacks,
                  supplierSubiektFeedback,
                  productLineFeedback,
                ]}
                resolvingSupplier={resolvingSupplier}
              />
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
            description={VERIFICATION_INTRO}
            action={<VerificationHelp />}
          />
          {workspaceBody}
        </Card>
      )}
    </div>
  );
}
