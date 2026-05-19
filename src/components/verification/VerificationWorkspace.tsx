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
  completenessUserHint,
} from "@/lib/orders/request-completeness";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Toast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { formatPlDate } from "@/lib/display-labels";
import { RequestCompletenessBanner } from "@/components/orders/RequestCompletenessBanner";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { RequestKindPicker } from "@/components/ui/RequestKindPicker";

export function VerificationWorkspace({
  orders,
  suppliers,
  salesPeople,
  onQueueEmpty,
}: {
  orders: IndividualOrder[];
  suppliers: { id: string; name: string }[];
  salesPeople: { id: string; name: string }[];
  /** Wywołane gdy kolejka się opróżni (np. zamknięcie modala). */
  onQueueEmpty?: () => void;
}) {
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

  const [form, setForm] = useState(() => ({
    supplierId: "",
    salesPersonId: "",
    symbol: "",
    product: "",
    quantity: "",
    requestKind: "zamowienie" as IndividualRequestKind,
  }));

  const loadOrder = useCallback((o: IndividualOrder) => {
    setActiveId(o.id);
    setForm({
      supplierId: o.supplier_id ?? "",
      salesPersonId: o.sales_person_id,
      symbol: o.symbol !== "-" ? o.symbol : "",
      product: o.products !== "Do uzupełnienia" ? o.products : "",
      quantity: o.quantity !== "-" ? o.quantity : "",
      requestKind: o.request_kind ?? "zamowienie",
    });
  }, []);

  useEffect(() => {
    const o = orders.find((x) => x.id === activeId);
    if (o) loadOrder(o);
  }, [activeId, orders, loadOrder]);

  const draft = {
    supplierId: form.supplierId,
    symbol: form.symbol,
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
          product: form.product,
          quantity: form.requestKind === "informacja" ? undefined : form.quantity,
          requestKind: form.requestKind,
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

  return (
    <div className="relative">
      {pendingMessage ? (
        <ActionLoadingOverlay message={pendingMessage} variant="viewport" />
      ) : null}
      {toast ? (
        <Toast message={toast.text} tone={toast.tone} onDismiss={() => setToast(null)} />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Card padding={false}>
          <CardHeader inset title="Kolejka" description={`${orders.length} pozycji`} />
          <ul className="max-h-[min(52vh,28rem)] divide-y divide-amber-100 overflow-y-auto">
            {orders.map((o) => (
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
                        {o.supplier?.name ?? "Brak dostawcy"} · {o.products}
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
            ))}
          </ul>
        </Card>

        {active ? (
          <Card className="max-h-[min(52vh,28rem)] overflow-y-auto">
            <CardHeader
              title="Uzupełnij dane"
              description={`Zgłoszenie od ${active.sales_person?.name ?? "handlowca"}`}
            />
            <div className="space-y-4">
              <RequestCompletenessBanner draft={draft} requestKind={form.requestKind} />

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Dostawca">
                  <Select
                    value={form.supplierId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, supplierId: e.target.value }))
                    }
                  >
                    <option value="">Wybierz…</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
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
                onChange={(requestKind) => setForm((f) => ({ ...f, requestKind }))}
              />

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Symbol">
                  <Input
                    value={form.symbol}
                    onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
                  />
                </Field>
                <Field label="Produkt" className="sm:col-span-2">
                  <Input
                    value={form.product}
                    onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))}
                  />
                </Field>
                {form.requestKind === "zamowienie" ? (
                  <Field label="Ilość (wymagane)">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      required
                      placeholder="np. 1"
                      value={form.quantity}
                      onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                    />
                  </Field>
                ) : null}
              </div>

              <p className="text-xs text-slate-500">
                {completenessUserHint(assessment, form.requestKind, draft).detail}
              </p>

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
          </Card>
        ) : null}
      </div>
    </div>
  );
}
