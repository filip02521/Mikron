"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionAddIndividualOrders } from "@/app/actions/admin";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Field, Select } from "@/components/ui/Field";
import { SupplierPickerField } from "@/components/orders/SupplierPickerField";
import { ModalShell } from "@/components/ui/ModalShell";
import { RequestKindPicker } from "@/components/ui/RequestKindPicker";
import type { IndividualRequestKind } from "@/types/database";
import { hasValidOrderQuantity } from "@/lib/orders/request-completeness";
import {
  RequestProductLinesEditor,
  initialProductLines,
} from "@/components/orders/RequestProductLinesEditor";
import { SubiektFeedbackAlert } from "@/components/subiekt/SubiektFeedbackAlert";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";

export function QuickOrderModal({
  open,
  onClose,
  suppliers,
  salesPeople,
}: {
  open: boolean;
  onClose: () => void;
  suppliers: { id: string; name: string }[];
  salesPeople: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [requestKind, setRequestKind] = useState<IndividualRequestKind>("zamowienie");
  const [supplierId, setSupplierId] = useState("");
  const [salesPersonId, setSalesPersonId] = useState("");
  const [lines, setLines] = useState(initialProductLines);
  const [msg, setMsg] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const [supplierSubiektFeedback, setSupplierSubiektFeedback] =
    useState<SubiektFeedback | null>(null);

  const reset = () => {
    setSupplierId("");
    setSalesPersonId("");
    setLines(initialProductLines());
    setMsg(null);
    setSupplierSubiektFeedback(null);
  };

  const submit = () => {
    if (!supplierId || !salesPersonId) {
      setMsg({ text: "Wybierz dostawcę i handlowca.", tone: "error" });
      return;
    }
    const entries = lines
      .filter((l) => l.product.trim() || l.symbol.trim())
      .map((l) => ({
        supplierId,
        salesPersonId,
        symbol: l.symbol,
        product: l.product,
        quantity: requestKind === "informacja" ? undefined : l.quantity,
        requestKind,
        subiektTwId: l.subiektTwId,
      }));
    if (!entries.length) {
      setMsg({ text: "Dodaj co najmniej jeden produkt z opisem.", tone: "error" });
      return;
    }
    if (
      requestKind === "zamowienie" &&
      entries.some((e) => !hasValidOrderQuantity(e.quantity, "zamowienie"))
    ) {
      setMsg({ text: "Każda pozycja musi mieć ilość (liczba sztuk, np. 1).", tone: "error" });
      return;
    }
    setPendingMessage("Zapisywanie prośby…");
    start(async () => {
      try {
        const r = await actionAddIndividualOrders(entries);
        setMsg({ text: `Dodano ${r.count} pozycji.`, tone: "success" });
        router.refresh();
        setTimeout(() => {
          reset();
          onClose();
        }, 600);
      } catch (e) {
        setMsg({
          text: e instanceof Error ? e.message : "Błąd zapisu",
          tone: "error",
        });
      } finally {
        setPendingMessage(null);
      }
    });
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Nowa prośba handlowca"
      description="Zamówienie lub prośba informacyjna — pojawi się w panelu dziennym."
      size="md"
      tier="raised"
      loadingMessage={pendingMessage}
      disableBackdropClose={pending}
      bodyClassName="space-y-4 px-5 py-4 sm:px-6"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Anuluj
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Zapisywanie…" : "Dodaj zamówienie"}
          </Button>
        </>
      }
    >
      {msg ? (
        <Alert tone={msg.tone === "success" ? "success" : "error"}>{msg.text}</Alert>
      ) : null}

      <RequestKindPicker value={requestKind} onChange={setRequestKind} compact />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Dostawca">
          <SupplierPickerField
            suppliers={suppliers}
            value={supplierId}
            onChange={setSupplierId}
            allowEmpty={false}
            emptyLabel="Wybierz dostawcę"
            placeholder="Szukaj dostawcy…"
          />
        </Field>
        <Field label="Dla kogo (handlowiec)">
          <Select value={salesPersonId} onChange={(e) => setSalesPersonId(e.target.value)}>
            <option value="">Wybierz…</option>
            {salesPeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {supplierSubiektFeedback ? (
        <SubiektFeedbackAlert feedback={supplierSubiektFeedback} compact />
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Produkty
        </p>
        <RequestProductLinesEditor
          lines={lines}
          onChange={setLines}
          requestKind={requestKind}
          suppliers={suppliers}
          onSupplierResolved={({ supplierId }) => {
            setSupplierSubiektFeedback(null);
            setSupplierId(supplierId);
          }}
          onSupplierResolveFeedback={setSupplierSubiektFeedback}
        />
      </div>
    </ModalShell>
  );
}
