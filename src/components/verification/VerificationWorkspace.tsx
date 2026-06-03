"use client";

import { useState, useTransition, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import type { IndividualOrder, IndividualRequestKind } from "@/types/database";
import {
  actionCancelVerification,
  actionCompleteVerification,
} from "@/app/actions/admin";
import { actionLookupSupplierFromCatalogTwId } from "@/app/actions/subiekt";
import { assessRequestCompleteness } from "@/lib/orders/request-completeness";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { Toast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionListLabel } from "@/components/ui/SectionListLabel";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconClipboardList, IconClipboardPen } from "@/components/icons/StrokeIcons";
import { VerificationHelp } from "@/components/verification/VerificationHelp";
import { formatPlDate } from "@/lib/display-labels";
import { verificationDraftMissingLabels, verificationQueueMissingLabels } from "@/lib/orders/verification-gaps";
import { RequestFormStatusPanel } from "@/components/orders/RequestFormStatusPanel";
import { ProsbaFormSection } from "@/components/orders/ProsbaFormSection";
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

const VERIFICATION_INTRO =
  "Niekompletne prośby handlowców — uzupełnij dostawcę i produkt. Po zatwierdzeniu trafiają do panelu dziennego jako „Nowe”.";

function orderToForm(o: IndividualOrder) {
  return {
    supplierId: o.supplier_id ?? "",
    salesPersonId: o.sales_person_id,
    symbol: o.symbol !== "-" ? o.symbol : "",
    mikranCode: o.mikran_code?.trim() ?? "",
    product: o.products !== "Do uzupełnienia" ? o.products : "",
    quantity: o.quantity !== "-" ? o.quantity : "",
    requestKind: (o.request_kind ?? "zamowienie") as IndividualRequestKind,
    subiektTwId: o.subiekt_tw_id ?? null,
  };
}

export function VerificationWorkspace({
  orders,
  suppliers,
  salesPeople,
  onQueueEmpty,
  layout = "page",
}: {
  orders: IndividualOrder[];
  suppliers: { id: string; name: string; subiekt_kh_id?: number | null }[];
  salesPeople: { id: string; name: string }[];
  onQueueEmpty?: () => void;
  layout?: "page" | "modal";
}) {
  const inModal = layout === "modal";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const [activeId, setActiveId] = useState<string | null>(orders[0]?.id ?? null);
  const [validationAttempted, setValidationAttempted] = useState(false);

  useEffect(() => {
    if (!orders.length) {
      onQueueEmpty?.();
      return;
    }
    if (!orders.some((o) => o.id === activeId)) {
      setActiveId(orders[0]?.id ?? null);
    }
  }, [orders, activeId, onQueueEmpty]);

  const active = orders.find((o) => o.id === activeId) ?? null;

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
  const loadedOrderIdRef = useRef<string | null>(null);
  const catalogLookupGenRef = useRef(0);

  const [form, setForm] = useState(() =>
    orders[0]
      ? orderToForm(orders[0])
      : {
          supplierId: "",
          salesPersonId: "",
          symbol: "",
          mikranCode: "",
          product: "",
          quantity: "",
          requestKind: "zamowienie" as IndividualRequestKind,
          subiektTwId: null as number | null,
        }
  );

  const resetSubiektFeedbacks = useCallback(() => {
    setSupplierSubiektFeedback(null);
    setSupplierPickerFeedbacks([]);
    setProductLineFeedback(null);
    setConfigFeedback(null);
    setResolvingSupplier(false);
  }, []);

  const applyOrder = useCallback(
    (o: IndividualOrder) => {
      catalogLookupGenRef.current += 1;
      const lookupGen = catalogLookupGenRef.current;
      setValidationAttempted(false);
      resetSubiektFeedbacks();
      setForm(orderToForm(o));

      const twId = o.subiekt_tw_id;
      if (!o.supplier_id && twId != null && twId > 0) {
        setResolvingSupplier(true);
        void actionLookupSupplierFromCatalogTwId(twId, supplierRefs).then((res) => {
          if (lookupGen !== catalogLookupGenRef.current) return;
          setResolvingSupplier(false);
          if (res.ok) {
            setForm((f) => ({ ...f, supplierId: res.supplierId }));
            setSupplierSubiektFeedback(null);
          } else {
            setSupplierSubiektFeedback(res.feedback);
          }
        });
      }
    },
    [resetSubiektFeedbacks, supplierRefs]
  );

  useEffect(() => {
    if (activeId && !orders.some((o) => o.id === activeId)) {
      loadedOrderIdRef.current = null;
      setActiveId(orders[0]?.id ?? null);
    }
  }, [orders, activeId]);

  useEffect(() => {
    if (!activeId || loadedOrderIdRef.current === activeId) return;
    loadedOrderIdRef.current = activeId;
    const o = orders.find((x) => x.id === activeId);
    if (o) applyOrder(o);
  }, [activeId, orders, applyOrder]);

  const draft = {
    supplierId: form.supplierId,
    symbol: form.symbol,
    mikranCode: form.mikranCode,
    product: form.product,
    quantity: form.quantity,
    requestKind: form.requestKind,
  };
  const assessment = assessRequestCompleteness(draft);

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
        });
        setToast({
          text: "Uzupełniono — prośba trafiła do panelu dziennego jako „Nowe”.",
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
  saveRef.current = save;

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
          })),
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  const cancel = (id: string) => {
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
            ? "flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:divide-x lg:divide-slate-100"
            : "grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:divide-x lg:divide-slate-100"
        }
      >
        <div
          className={
            inModal
              ? "flex min-h-0 shrink-0 flex-col border-b border-slate-100 lg:min-h-0 lg:shrink lg:border-b-0"
              : "min-w-0"
          }
        >
          <SectionListLabel
            title="Kolejka"
            hint="Wybierz prośbę z listy"
            count={orders.length}
            icon={<IconClipboardList size={17} />}
            tileClassName="bg-amber-100 text-amber-800"
          />
          <ul
            className={
              inModal
                ? "max-h-[11rem] divide-y divide-amber-100 overflow-y-auto overscroll-contain sm:max-h-[13rem] lg:max-h-none lg:min-h-0 lg:flex-1"
                : "divide-y divide-amber-100"
            }
          >
            {orders.map((o) => {
              const missing =
                o.id === activeId
                  ? verificationDraftMissingLabels(form)
                  : verificationQueueMissingLabels(o);
              const supplierLabel =
                o.id === activeId && form.supplierId
                  ? (suppliers.find((s) => s.id === form.supplierId)?.name ??
                    o.supplier?.name ??
                    "Brak dostawcy")
                  : (o.supplier?.name ?? "Brak dostawcy");
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(o.id)}
                    className={`w-full px-4 py-3 text-left transition hover:bg-amber-50/80 ${
                      activeId === o.id ? "bg-amber-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">
                          {o.sales_person?.name ?? "Handlowiec"}
                        </p>
                        <p className="truncate text-sm text-slate-600">
                          {supplierLabel} · {o.products}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatPlDate(o.action_at.slice(0, 10))}
                          {o.request_kind === "informacja" ? " · informacja" : ""}
                          {o.subiekt_tw_id ? " · Subiekt" : ""}
                        </p>
                        {missing.length ? (
                          <p className="mt-1 text-[0.68rem] font-medium text-amber-800">
                            Brakuje: {missing.join(", ")}
                          </p>
                        ) : (
                          <p className="mt-1 text-[0.68rem] font-medium text-emerald-700">
                            Gotowe do zatwierdzenia
                          </p>
                        )}
                      </div>
                      <Badge variant="warning">Weryfikacja</Badge>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {active ? (
          <div
            className={
              inModal ? "flex min-h-0 min-w-0 flex-1 flex-col lg:min-h-0" : "min-w-0"
            }
          >
            <SectionListLabel
              title="Uzupełnij dane"
              hint={`Zgłoszenie od ${active.sales_person?.name ?? "handlowca"}`}
              icon={<IconClipboardPen size={17} />}
              tileClassName="bg-amber-100 text-amber-800"
            />
            <div
              className={
                inModal
                  ? "min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 lg:overflow-y-auto"
                  : "space-y-5 px-4 py-5 sm:px-6"
              }
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-slate-100 bg-slate-50/70 px-3 py-2">
                <span className="shrink-0 text-xs font-medium text-slate-600">
                  Skróty klawiszowe
                </span>
                <KeyboardShortcutsHint
                  items={PROCUREMENT_PROSBA_KEYBOARD_HINTS.filter(
                    (h) => h.keys[0] !== "+"
                  )}
                  compact
                />
              </div>

              <ProsbaFormSection
                title="Co chcesz zgłosić?"
                hint="Rodzaj prośby decyduje o wymaganych polach produktu."
              >
                <RequestKindToggle
                  value={form.requestKind}
                  onChange={(requestKind) =>
                    setForm((f) => ({
                      ...f,
                      requestKind,
                      quantity: requestKind === "informacja" ? "" : f.quantity,
                    }))
                  }
                />
              </ProsbaFormSection>

              <ProsbaFormSection
                title="Dla kogo i u kogo?"
                hint="Handlowiec oraz dostawca przypisany do prośby."
              >
                <div className="grid gap-4 lg:grid-cols-2">
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
                      dropdownSize="comfortable"
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
              </ProsbaFormSection>

              <ProsbaFormSection
                title="Produkt"
                hint={
                  form.subiektTwId
                    ? "Towar powiązany z Subiektem — możesz wyszukać inny wpisując symbol, kod Mikran lub nazwę."
                    : form.requestKind === "informacja"
                      ? "Wystarczy symbol, kod Mikran lub opis — bez ilości."
                      : "Podaj symbol, kod Mikran lub opis oraz ilość."
                }
              >
                <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                  <SubiektProductLineFields
                    appearance="prosba"
                    requestKind={form.requestKind}
                    suppliers={supplierRefs}
                    delegateAlerts
                    typeaheadSize="comfortable"
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
                subiektFeedbacks={[
                  configFeedback,
                  ...supplierPickerFeedbacks,
                  supplierSubiektFeedback,
                  productLineFeedback,
                ]}
                resolvingSupplier={resolvingSupplier}
                formMessage={
                  validationAttempted && assessment !== "complete"
                    ? {
                        text:
                          form.requestKind === "zamowienie"
                            ? "Uzupełnij dostawcę, opis produktu i ilość (np. 1)."
                            : "Uzupełnij dostawcę oraz opis produktu.",
                        tone: "error",
                      }
                    : null
                }
              />

              <div className="flex flex-wrap gap-2">
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
              </div>
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
          : "relative mx-auto max-w-6xl"
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
