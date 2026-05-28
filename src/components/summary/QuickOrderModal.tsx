"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionAddIndividualOrders } from "@/app/actions/admin";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { SupplierPickerField } from "@/components/orders/SupplierPickerField";
import { ModalShell } from "@/components/ui/ModalShell";
import { RequestKindPicker } from "@/components/ui/RequestKindPicker";
import type { IndividualRequestKind } from "@/types/database";
import { hasValidOrderQuantity } from "@/lib/orders/request-completeness";
import { assertProcurementEntryComplete } from "@/lib/orders/procurement-submit";
import {
  RequestProductLinesEditor,
  initialProductLines,
} from "@/components/orders/RequestProductLinesEditor";
import { RequestFormStatusPanel } from "@/components/orders/RequestFormStatusPanel";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { toAppSupplierRefs } from "@/lib/subiekt/match-supplier";

export function QuickOrderModal({
  open,
  onClose,
  suppliers,
  salesPeople,
}: {
  open: boolean;
  onClose: () => void;
  suppliers: { id: string; name: string; subiekt_kh_id?: number | null }[];
  salesPeople: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [requestKind, setRequestKind] = useState<IndividualRequestKind>("zamowienie");
  const [supplierId, setSupplierId] = useState("");
  const [salesPersonId, setSalesPersonId] = useState("");
  const [lines, setLines] = useState(initialProductLines);
  const [formNotice, setFormNotice] = useState<{
    text: string;
    tone: "error" | "warning" | "success";
  } | null>(null);
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

  const reset = () => {
    setSupplierId("");
    setSalesPersonId("");
    setLines(initialProductLines());
    setFormNotice(null);
    setSupplierSubiektFeedback(null);
    setSupplierPickerFeedbacks([]);
    setProductLineFeedback(null);
    setConfigFeedback(null);
    setResolvingSupplier(false);
  };

  const submit = () => {
    setFormNotice(null);
    if (!supplierId || !salesPersonId) {
      setFormNotice({ text: "Wybierz dostawcę i handlowca.", tone: "error" });
      return;
    }
    const entries = lines
      .filter((l) => l.product.trim() || l.symbol.trim() || l.mikranCode.trim())
      .map((l) => ({
        supplierId,
        salesPersonId,
        symbol: l.symbol,
        mikranCode: l.mikranCode,
        product: l.product,
        quantity: requestKind === "informacja" ? undefined : l.quantity,
        requestKind,
        subiektTwId: l.subiektTwId,
      }));
    if (!entries.length) {
      setFormNotice({ text: "Dodaj co najmniej jeden produkt z opisem.", tone: "error" });
      return;
    }
    if (
      requestKind === "zamowienie" &&
      entries.some((e) => !hasValidOrderQuantity(e.quantity, "zamowienie"))
    ) {
      setFormNotice({
        text: "Każda pozycja musi mieć ilość (liczba sztuk, np. 1).",
        tone: "error",
      });
      return;
    }
    try {
      let lineNo = 0;
      for (const e of entries) {
        lineNo += 1;
        assertProcurementEntryComplete(
          {
            supplierId: e.supplierId,
            symbol: e.symbol,
            mikranCode: e.mikranCode,
            product: e.product,
            quantity: e.quantity,
            requestKind,
            subiektTwId: e.subiektTwId,
          },
          entries.length > 1 ? `Pozycja ${lineNo}` : undefined
        );
      }
    } catch (err) {
      setFormNotice({
        text: err instanceof Error ? err.message : "Uzupełnij wymagane pola.",
        tone: "error",
      });
      return;
    }
    setPendingMessage("Zapisywanie prośby…");
    start(async () => {
      try {
        const r = await actionAddIndividualOrders(entries);
        setFormNotice({ text: `Dodano ${r.count} pozycji.`, tone: "success" });
        router.refresh();
        setTimeout(() => {
          reset();
          onClose();
        }, 600);
      } catch (e) {
        setFormNotice({
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
      size="lg"
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
            showInlineFeedback={false}
            onSubiektFeedbackChange={setSupplierPickerFeedbacks}
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

      <RequestProductLinesEditor
        lines={lines}
        onChange={setLines}
        requestKind={requestKind}
        appearance="default"
        suppliers={supplierRefs}
        unifiedFeedback
        onSupplierResolved={({ supplierId }) => {
          setSupplierSubiektFeedback(null);
          setSupplierId(supplierId);
        }}
        onSupplierMappingMissing={() => setSupplierId("")}
        onSupplierResolveFeedback={setSupplierSubiektFeedback}
        onProductFeedbackChange={setProductLineFeedback}
        onConfigFeedbackChange={setConfigFeedback}
        onResolvingSupplierChange={setResolvingSupplier}
      />

      <RequestFormStatusPanel
        requestKind={requestKind}
        draft={{
          supplierId,
          symbol: lines.find((l) => l.symbol.trim())?.symbol,
          mikranCode: lines.find((l) => l.mikranCode.trim())?.mikranCode,
          product: lines.find((l) => l.product.trim())?.product,
          quantity: lines.find((l) => l.quantity.trim())?.quantity,
          requestKind,
        }}
        subiektFeedbacks={[
          configFeedback,
          ...supplierPickerFeedbacks,
          supplierSubiektFeedback,
          productLineFeedback,
        ]}
        resolvingSupplier={resolvingSupplier}
        formMessage={formNotice}
        audience="procurement"
      />
    </ModalShell>
  );
}
