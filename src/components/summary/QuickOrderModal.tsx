"use client";

import { useMemo, useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { actionAddIndividualOrders } from "@/app/actions/admin";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { SupplierPickerField } from "@/components/orders/SupplierPickerField";
import { ProcurementFormReadiness } from "@/components/orders/ProcurementFormReadiness";
import { ProsbaFormSection } from "@/components/orders/ProsbaFormSection";
import { RequestKindToggle } from "@/components/orders/RequestKindToggle";
import { ModalShell } from "@/components/ui/ModalShell";
import { KeyboardShortcutsHint } from "@/components/ui/KeyboardShortcutsHint";
import type { IndividualRequestKind } from "@/types/database";
import { hasValidOrderQuantity } from "@/lib/orders/request-completeness";
import { assertProcurementEntryComplete } from "@/lib/orders/procurement-submit";
import {
  RequestProductLinesEditor,
  initialProductLines,
} from "@/components/orders/RequestProductLinesEditor";
import { appendProductLine } from "@/components/orders/request-product-lines";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { toAppSupplierRefs } from "@/lib/subiekt/match-supplier";
import { buildProcurementFormReadiness } from "@/lib/orders/procurement-form-readiness";
import { InformacjaFlowPicker } from "@/components/orders/InformacjaFlowPicker";
import {
  DEFAULT_INFORMACJA_FLOW_PATH,
  INFORMACJA_FLOW_PICKER_SECTION_DAILY,
  informacjaProductsFormHint,
} from "@/lib/orders/informacja-flow-ui";
import {
  flagsFromInformacjaFlowPath,
  type InformacjaFlowPath,
} from "@/lib/orders/informacja-stock-out-reorder";
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
  const [informacjaPath, setInformacjaPath] = useState<InformacjaFlowPath>(
    DEFAULT_INFORMACJA_FLOW_PATH
  );
  const [supplierId, setSupplierId] = useState("");
  const [salesPersonId, setSalesPersonId] = useState("");
  const [lines, setLines] = useState(initialProductLines);
  const [validationAttempted, setValidationAttempted] = useState(false);
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

  const informacjaFlags = useMemo(
    () =>
      requestKind === "informacja"
        ? flagsFromInformacjaFlowPath(informacjaPath)
        : {
            informacjaQueueViaDailyPanel: false,
            informacjaStockOutReorder: false,
          },
    [requestKind, informacjaPath]
  );

  const readinessView = useMemo(
    () =>
      buildProcurementFormReadiness({
        salesPersonId,
        supplierId,
        lines: readinessLines,
        requestKind,
        ...informacjaFlags,
      }),
    [salesPersonId, supplierId, readinessLines, requestKind, informacjaFlags]
  );

  const submitLabel =
    requestKind === "informacja"
      ? "Dodaj prośbę informacyjną"
      : "Dodaj zamówienie";

  const reset = () => {
    setSupplierId("");
    setSalesPersonId("");
    setLines(initialProductLines());
    setValidationAttempted(false);
    setFormNotice(null);
    setSupplierSubiektFeedback(null);
    setSupplierPickerFeedbacks([]);
    setProductLineFeedback(null);
    setConfigFeedback(null);
    setResolvingSupplier(false);
    setInformacjaPath(DEFAULT_INFORMACJA_FLOW_PATH);
  };

  const submitRef = useRef<() => void>(() => {});
  const addLineRef = useRef<() => void>(() => {});

  const submit = () => {
    setFormNotice(null);
    setValidationAttempted(false);
    if (!supplierId || !salesPersonId) {
      setValidationAttempted(true);
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
        informacjaQueueViaDailyPanel: informacjaFlags.informacjaQueueViaDailyPanel,
        informacjaStockOutReorder: informacjaFlags.informacjaStockOutReorder,
      }));
    if (!entries.length) {
      setValidationAttempted(true);
      setFormNotice({ text: "Dodaj co najmniej jeden produkt z opisem.", tone: "error" });
      return;
    }
    if (
      requestKind === "zamowienie" &&
      entries.some((e) => !hasValidOrderQuantity(e.quantity, "zamowienie"))
    ) {
      setValidationAttempted(true);
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
            informacjaQueueViaDailyPanel: informacjaFlags.informacjaQueueViaDailyPanel,
            informacjaStockOutReorder: informacjaFlags.informacjaStockOutReorder,
          },
          entries.length > 1 ? `Pozycja ${lineNo}` : undefined
        );
      }
    } catch (err) {
      setValidationAttempted(true);
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
              ? informacjaFlags.informacjaStockOutReorder
                ? `Dodano ${r.count} sygnał(ów) „brak na stanie” — w panelu Dziś (Prośby handlowców).`
                : informacjaFlags.informacjaQueueViaDailyPanel
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
  addLineRef.current = () => setLines((prev) => appendProductLine(prev));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      handleProcurementProsbaKeyboardEvent(e, {
        pending,
        onSubmit: () => submitRef.current(),
        onSetRequestKind: (kind) => {
          setRequestKind(kind);
          if (kind === "informacja") setInformacjaPath(DEFAULT_INFORMACJA_FLOW_PATH);
          else setInformacjaPath("direct");
        },
        onAddProductLine: () => addLineRef.current(),
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
      size="xl"
      tier="raised"
      className="max-h-[min(calc(100dvh-1rem),920px)]"
      loadingMessage={pendingMessage}
      disableBackdropClose={pending}
      bodyClassName="flex min-h-0 flex-1 flex-col"
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-100 bg-slate-50/60 px-5 py-2.5 sm:px-6">
        <span className="shrink-0 text-xs font-medium text-slate-600">Skróty klawiszowe</span>
        <KeyboardShortcutsHint items={[...PROCUREMENT_PROSBA_KEYBOARD_HINTS]} compact />
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
        <ProsbaFormSection
          title="Co chcesz zgłosić?"
          hint="Wybierz jedną opcję — pola poniżej dopasują się do rodzaju prośby."
        >
          <RequestKindToggle
            value={requestKind}
            onChange={(kind) => {
              setRequestKind(kind);
              if (kind === "informacja") setInformacjaPath(DEFAULT_INFORMACJA_FLOW_PATH);
          else setInformacjaPath("direct");
            }}
          />
        </ProsbaFormSection>

        {requestKind === "informacja" ? (
          <ProsbaFormSection
            title={INFORMACJA_FLOW_PICKER_SECTION_DAILY.title}
            hint={INFORMACJA_FLOW_PICKER_SECTION_DAILY.hint}
          >
            <InformacjaFlowPicker
              path={informacjaPath}
              onChange={setInformacjaPath}
              disabled={pending}
              includeViaPanel
            />
          </ProsbaFormSection>
        ) : null}

        <ProsbaFormSection
          title="Dla kogo i u kogo?"
          hint="Handlowiec, którego dotyczy prośba, oraz dostawca u którego składamy zamówienie."
        >
          <div className="grid gap-4 lg:grid-cols-2">
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
                dropdownSize="comfortable"
                onSubiektFeedbackChange={setSupplierPickerFeedbacks}
              />
            </Field>
          </div>
        </ProsbaFormSection>

        <ProsbaFormSection
          title="Produkty"
          hint={
            requestKind === "informacja"
              ? informacjaProductsFormHint(informacjaPath)
              : "Podaj nazwę lub symbol w jednym polu, kod Mikran obok oraz ilość przy każdej pozycji."
          }
        >
          <div className="space-y-4">
            <RequestProductLinesEditor
              lines={lines}
              onChange={(next) => {
                setFormNotice(null);
                setLines(next);
              }}
              requestKind={requestKind}
              appearance="prosba"
              addLabel="+ Kolejny produkt"
              suppliers={supplierRefs}
              unifiedFeedback
              typeaheadSize="comfortable"
              validationAttempted={validationAttempted}
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
              informacjaViaDailyPanel={informacjaFlags.informacjaQueueViaDailyPanel}
              informacjaStockOutReorder={informacjaFlags.informacjaStockOutReorder}
              formMessage={formNotice}
              resolvingSupplier={resolvingSupplier}
              subiektFeedbacks={[
                configFeedback,
                ...supplierPickerFeedbacks,
                supplierSubiektFeedback,
                productLineFeedback,
              ]}
            />
          </div>
        </ProsbaFormSection>
      </div>
    </ModalShell>
  );
}
