"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { IndividualOrder, IndividualRequestKind } from "@/types/database";
import {
  actionCancelVerification,
  actionCompleteVerification,
} from "@/app/actions/admin";
import {
  assessRequestCompleteness,
} from "@/lib/orders/request-completeness";
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
import { describeVerificationGaps } from "@/lib/orders/verification-gaps";
import { RequestFormStatusPanel } from "@/components/orders/RequestFormStatusPanel";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { RequestKindPicker } from "@/components/ui/RequestKindPicker";
import { SupplierPickerField } from "@/components/orders/SupplierPickerField";
import { SubiektProductLineFields } from "@/components/subiekt/SubiektProductLineFields";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { toAppSupplierRefs } from "@/lib/subiekt/match-supplier";

const VERIFICATION_INTRO =
  "Niekompletne prośby handlowców — uzupełnij dostawcę i produkt. Po zatwierdzeniu trafiają do panelu dziennego jako „Nowe”.";

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
  /** Wywołane gdy kolejka się opróżni (np. zamknięcie modala). */
  onQueueEmpty?: () => void;
  /** `modal` — bez duplikatu nagłówka, kolumny wypełniają wysokość okna. */
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

  const supplierRefs = toAppSupplierRefs(suppliers);

  const [form, setForm] = useState(() => ({
    supplierId: "",
    salesPersonId: "",
    symbol: "",
    mikranCode: "",
    product: "",
    quantity: "",
    requestKind: "zamowienie" as IndividualRequestKind,
    subiektTwId: null as number | null,
  }));

  const loadOrder = useCallback((o: IndividualOrder) => {
    setActiveId(o.id);
    setSupplierSubiektFeedback(null);
    setSupplierPickerFeedbacks([]);
    setProductLineFeedback(null);
    setConfigFeedback(null);
    setResolvingSupplier(false);
    setForm({
      supplierId: o.supplier_id ?? "",
      salesPersonId: o.sales_person_id,
      symbol: o.symbol !== "-" ? o.symbol : "",
      mikranCode: o.mikran_code?.trim() ?? "",
      product: o.products !== "Do uzupełnienia" ? o.products : "",
      quantity: o.quantity !== "-" ? o.quantity : "",
      requestKind: o.request_kind ?? "zamowienie",
      subiektTwId: o.subiekt_tw_id ?? null,
    });
  }, []);

  useEffect(() => {
    const o = orders.find((x) => x.id === activeId);
    if (o) loadOrder(o);
  }, [activeId, orders, loadOrder]);

  const draft = {
    supplierId: form.supplierId,
    symbol: form.symbol,
    mikranCode: form.mikranCode,
    product: form.product,
    quantity: form.quantity,
    requestKind: form.requestKind,
  };
  const assessment = assessRequestCompleteness(draft);

  const save = () => {
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
                  return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => loadOrder(o)}
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
                            {(o.supplier?.name ?? "Brak dostawcy")}{" "}
                            · {o.products}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatPlDate(o.action_at.slice(0, 10))}
                            {o.request_kind === "informacja" ? " · informacja" : ""}
                          </p>
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
                  ? "min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 lg:overflow-y-auto"
                  : "space-y-4 px-4 py-5 sm:px-6"
              }
            >
                  <div className="grid gap-3 sm:grid-cols-2">
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

                  <RequestKindPicker
                    compact
                    value={form.requestKind}
                    onChange={(requestKind) =>
                      setForm((f) => ({
                        ...f,
                        requestKind,
                        quantity: requestKind === "informacja" ? "" : f.quantity,
                      }))
                    }
                  />

                  <SubiektProductLineFields
                    appearance="prosba"
                    requestKind={form.requestKind}
                    suppliers={supplierRefs}
                    delegateAlerts
                    onSupplierResolved={({ supplierId }) => {
                      setSupplierSubiektFeedback(null);
                      setForm((f) => ({ ...f, supplierId }));
                    }}
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

                  <RequestFormStatusPanel
                    requestKind={form.requestKind}
                    draft={draft}
                    subiektFeedbacks={[
                      configFeedback,
                      ...supplierPickerFeedbacks,
                      supplierSubiektFeedback,
                      productLineFeedback,
                    ]}
                    resolvingSupplier={resolvingSupplier}
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
