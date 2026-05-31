"use client";

import { useMemo, useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { actionAddIndividualOrders } from "@/app/actions/admin";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { SupplierPickerField } from "@/components/orders/SupplierPickerField";
import { ProcurementFormReadiness } from "@/components/orders/ProcurementFormReadiness";
import { ModalShell } from "@/components/ui/ModalShell";
import { RequestKindPicker } from "@/components/ui/RequestKindPicker";
import type { IndividualRequestKind } from "@/types/database";
import { hasValidOrderQuantity } from "@/lib/orders/request-completeness";
import { assertProcurementEntryComplete } from "@/lib/orders/procurement-submit";
import {
  RequestProductLinesEditor,
  initialProductLines,
} from "@/components/orders/RequestProductLinesEditor";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { toAppSupplierRefs } from "@/lib/subiekt/match-supplier";
import { buildProcurementFormReadiness } from "@/lib/orders/procurement-form-readiness";
import { InformacjaFlowPicker } from "@/components/orders/InformacjaFlowPicker";
import {
  handleProcurementProsbaKeyboardEvent,
  PROCUREMENT_PROSBA_KEYBOARD_HINTS,
} from "@/lib/orders/procurement-prosba-keyboard";

export function QuickOrderModal({
  open,
  onClose,
  suppliers,
  salesPeople,
}: {
  open: boolean;
  onClose: () => void;
  suppliers: { id: string; name: string; subiekt_kh_id?: number | null }[];
  /** Wyłącznie karty z Admin → Handlowcy (fetchSalesPeopleForPicker). */
  salesPeople: { id: string; name: string; email: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [requestKind, setRequestKind] = useState<IndividualRequestKind>("zamowienie");
  const [informacjaViaDailyPanel, setInformacjaViaDailyPanel] = useState(false);
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

  const readinessLines = useMemo(
    () =>
      lines.map((l) => ({
        symbol: l.symbol,
        mikranCode: l.mikranCode,
        product: l.product,
        quantity: l.quantity,
        supplierId,
        subiektTwId: l.subiektTwId,
      })),
    [lines, supplierId]
  );

  const readinessView = useMemo(
    () =>
      buildProcurementFormReadiness({
        salesPersonId,
        supplierId,
        lines: readinessLines,
        requestKind,
        informacjaViaDailyPanel,
      }),
    [salesPersonId, supplierId, readinessLines, requestKind, informacjaViaDailyPanel]
  );

  const submitLabel =
    requestKind === "informacja"
      ? "Dodaj prośbę informacyjną"
      : "Dodaj zamówienie";

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
    setInformacjaViaDailyPanel(false);
  };

  const submitRef = useRef<() => void>(() => {});

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
        informacjaQueueViaDailyPanel:
          requestKind === "informacja" && informacjaViaDailyPanel,
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
            informacjaQueueViaDailyPanel:
              requestKind === "informacja" && informacjaViaDailyPanel,
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
        setFormNotice({
          text:
            requestKind === "informacja"
              ? informacjaViaDailyPanel
                ? `Dodano ${r.count} prośb(y) informacyjn(e) — najpierw kolejka Dziś (Główne/Uzupełniające).`
                : `Dodano ${r.count} prośb(y) informacyjn(e) — od razu do kolejki magazynu.`
              : `Dodano ${r.count} pozycji do panelu dziennego.`,
          tone: "success",
        });
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
  submitRef.current = submit;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      handleProcurementProsbaKeyboardEvent(e, {
        pending,
        onSubmit: () => submitRef.current(),
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending]);

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
      bodyClassName="space-y-3 px-5 py-4 sm:px-6"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Anuluj
          </Button>
          <Button onClick={submit} disabled={pending || !readinessView.canSubmit}>
            {pending ? "Zapisywanie…" : submitLabel}
          </Button>
        </>
      }
    >
      <RequestKindPicker
        value={requestKind}
        onChange={(k) => {
          setRequestKind(k);
          if (k !== "informacja") setInformacjaViaDailyPanel(false);
        }}
        compact
      />

      {requestKind === "informacja" ? (
        <InformacjaFlowPicker
          viaDailyPanel={informacjaViaDailyPanel}
          onChange={setInformacjaViaDailyPanel}
          disabled={pending}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Dla kogo (handlowiec)"
          hint={`Lista z Admin → Handlowcy (${salesPeople.length} ${salesPeople.length === 1 ? "osoba" : "osób"})`}
        >
          <Select
            value={salesPersonId}
            disabled={pending || salesPeople.length === 0}
            onChange={(e) => setSalesPersonId(e.target.value)}
          >
            <option value="">— wybierz handlowca —</option>
            {salesPeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
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
      </div>

      <RequestProductLinesEditor
        lines={lines}
        onChange={setLines}
        requestKind={requestKind}
        appearance="default"
        suppliers={supplierRefs}
        unifiedFeedback
        onSupplierResolved={({ supplierId: id }) => {
          setSupplierSubiektFeedback(null);
          setSupplierId(id);
        }}
        onSupplierMappingMissing={() => setSupplierId("")}
        onSupplierResolveFeedback={setSupplierSubiektFeedback}
        onProductFeedbackChange={setProductLineFeedback}
        onConfigFeedbackChange={setConfigFeedback}
        onResolvingSupplierChange={setResolvingSupplier}
      />

      <ProcurementFormReadiness
        salesPersonId={salesPersonId}
        supplierId={supplierId}
        lines={readinessLines}
        requestKind={requestKind}
        informacjaViaDailyPanel={informacjaViaDailyPanel}
        formMessage={formNotice}
        resolvingSupplier={resolvingSupplier}
        subiektFeedbacks={[
          configFeedback,
          ...supplierPickerFeedbacks,
          supplierSubiektFeedback,
          productLineFeedback,
        ]}
      />
    </ModalShell>
  );
}
