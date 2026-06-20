"use client";

import { useMemo, useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { actionAddIndividualOrders } from "@/app/actions/admin";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { HelpHintBubble } from "@/components/ui/HelpHintBubble";
import { IconUserGroup } from "@/components/icons/StrokeIcons";
import { SupplierPickerField } from "@/components/orders/SupplierPickerField";
import { ProsbaFormReadiness } from "@/components/orders/ProsbaFormReadiness";
import {
  ProsbaFormInformacjaSection,
  ProsbaFormKeyboardStrip,
  ProsbaFormProductsSection,
  ProsbaFormRequestKindSection,
} from "@/components/orders/ProsbaFormSharedSections";
import { ProsbaFormSection } from "@/components/orders/ProsbaFormSection";
import { ModalShell } from "@/components/ui/ModalShell";
import type { IndividualRequestKind } from "@/types/database";
import { hasValidOrderQuantity } from "@/lib/orders/request-completeness";
import { assertProcurementEntryComplete } from "@/lib/orders/procurement-submit";
import {
  RequestProductLinesEditor,
  initialProductLines,
} from "@/components/orders/RequestProductLinesEditor";
import { appendProductLine } from "@/components/orders/request-product-lines";
import { toAppSupplierRefs } from "@/lib/subiekt/match-supplier";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";
import { buildProsbaFormReadinessWithSupplier } from "@/lib/orders/prosba-form-readiness";
import {
  DEFAULT_INFORMACJA_FLOW_PATH,
} from "@/lib/orders/informacja-flow-ui";
import { PROSBA_FORM_SECTION_COPY } from "@/lib/orders/prosba-form-section-copy";
import { PROSBA_PAGE_HEADER_HINTS } from "@/lib/orders/prosba-optional-section-copy";
import {
  flagsFromInformacjaFlowPath,
  type InformacjaFlowPath,
} from "@/lib/orders/informacja-stock-out-reorder";
import {
  handleProcurementProsbaKeyboardEvent,
  PROCUREMENT_PROSBA_KEYBOARD_HINTS,
} from "@/lib/orders/procurement-prosba-keyboard";
import { ProsbaStockConfirmDialog } from "@/components/orders/ProsbaStockConfirmDialog";
import { buildProsbaSubmitStockConfirm } from "@/lib/orders/prosba-stock-check";
import { handleProsbaStockSubmitError } from "@/lib/orders/prosba-stock-submit-error";
import type { AddIndividualOrdersEntry } from "@/lib/orders/individual-request-edit";

export function QuickOrderModal({
  open,
  onClose,
  suppliers,
  salesPeople,
}: {
  open: boolean;
  onClose: () => void;
  suppliers: OrderFormSupplierOption[];
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
  const [resolvingSupplier, setResolvingSupplier] = useState(false);
  const [stockConfirmOpen, setStockConfirmOpen] = useState(false);
  const [stockConfirmMessage, setStockConfirmMessage] = useState("");
  const pendingSubmitRef = useRef<AddIndividualOrdersEntry[]>([]);

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
        clientName: l.clientName,
        clientKhId: l.clientKhId,
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

  const prosbaReadiness = useMemo(
    () =>
      buildProsbaFormReadinessWithSupplier(readinessLines, supplierId, requestKind, {
        informacjaPath,
        resolvingSupplier,
      }),
    [readinessLines, supplierId, requestKind, informacjaPath, resolvingSupplier]
  );

  const canSubmitProsba =
    Boolean(salesPersonId.trim()) &&
    Boolean(supplierId.trim()) &&
    prosbaReadiness.view.canSubmit &&
    !resolvingSupplier;

  const submitLabel =
    requestKind === "informacja"
      ? "Dodaj prośbę informacyjną"
      : "Dodaj zamówienie";

  const reset = () => {
    setRequestKind("zamowienie");
    setSupplierId("");
    setSalesPersonId("");
    setLines(initialProductLines());
    setValidationAttempted(false);
    setFormNotice(null);
    setResolvingSupplier(false);
    setInformacjaPath(DEFAULT_INFORMACJA_FLOW_PATH);
    setStockConfirmOpen(false);
    setStockConfirmMessage("");
    pendingSubmitRef.current = [];
  };

  const handleClose = () => {
    reset();
    onClose();
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
        onHand: l.onHand,
        reserved: l.reserved,
        available: l.available,
        stockSource: l.stockSource,
        informacjaQueueViaDailyPanel: informacjaFlags.informacjaQueueViaDailyPanel,
        informacjaStockOutReorder: informacjaFlags.informacjaStockOutReorder,
        clientName: l.clientName,
        clientKhId: l.clientKhId,
        requestNote: l.requestNote?.trim() || undefined,
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
    const stockConfirm = buildProsbaSubmitStockConfirm(lines, requestKind);
    if (stockConfirm) {
      pendingSubmitRef.current = entries;
      setStockConfirmMessage(stockConfirm.message);
      setStockConfirmOpen(true);
      return;
    }
    performSubmit(entries);
  };

  const performSubmit = (
    entries: AddIndividualOrdersEntry[],
    options?: { acknowledgeSufficientStock?: boolean }
  ) => {
    setPendingMessage("Zapisywanie prośby…");
    start(async () => {
      try {
        const r = await actionAddIndividualOrders({
          entries,
          acknowledgeSufficientStock: options?.acknowledgeSufficientStock,
        });
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
          handleClose();
        }, 600);
        setStockConfirmOpen(false);
      } catch (e) {
        handleProsbaStockSubmitError(
          e,
          (message) => {
            setStockConfirmMessage(message);
            setStockConfirmOpen(true);
          },
          (message) => {
            setFormNotice({ text: message, tone: "error" });
          }
        );
      } finally {
        setPendingMessage(null);
      }
    });
  };

  useEffect(() => {
    submitRef.current = submit;
    addLineRef.current = () => setLines((prev) => appendProductLine(prev));
  });

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
    <>
      <ProsbaStockConfirmDialog
        open={stockConfirmOpen}
        message={stockConfirmMessage}
        pending={pending}
        onCancel={() => {
          setStockConfirmOpen(false);
          pendingSubmitRef.current = [];
        }}
        onConfirm={() =>
          performSubmit(pendingSubmitRef.current, { acknowledgeSufficientStock: true })
        }
      />
    <ModalShell
      open={open}
      onClose={handleClose}
      title="Nowa prośba handlowca"
      titleHint={PROSBA_PAGE_HEADER_HINTS.dailyNewRequest}
      titleHintAriaLabel="O formularzu prośby"
      size="xl"
      tier="raised"
      className="max-h-[min(calc(100dvh-1rem),920px)]"
      loadingMessage={pendingMessage}
      disableBackdropClose={pending}
      bodyClassName="flex min-h-0 flex-1 flex-col"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={pending}>
            Anuluj
          </Button>
          <Button onClick={submit} disabled={pending || !canSubmitProsba}>
            {pending ? "Zapisywanie…" : submitLabel}
          </Button>
        </>
      }
    >
      <ProsbaFormKeyboardStrip
        hints={PROCUREMENT_PROSBA_KEYBOARD_HINTS}
        variant="procurement"
      />

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <ProsbaFormRequestKindSection
          value={requestKind}
          disabled={pending}
          onChange={(kind) => {
            setRequestKind(kind);
            if (kind === "informacja") setInformacjaPath(DEFAULT_INFORMACJA_FLOW_PATH);
            else setInformacjaPath("direct");
          }}
        />

        {requestKind === "informacja" ? (
          <ProsbaFormInformacjaSection
            path={informacjaPath}
            onChange={setInformacjaPath}
            disabled={pending}
            includeViaPanel
          />
        ) : null}

        <ProsbaFormSection
          title={PROSBA_FORM_SECTION_COPY.delegateProcurement.title}
          hint={PROSBA_FORM_SECTION_COPY.delegateProcurement.hint}
          accent="indigo"
          icon={<IconUserGroup size={17} />}
          tileClassName="bg-indigo-100 text-indigo-800"
        >
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <Field
              labelClassName="inline-flex min-h-6 items-center gap-1"
              label={
                <>
                  Dla kogo (handlowiec)
                  <HelpHintBubble
                    message={`Wybierz handlowca z listy Admin → Handlowcy (${salesPeople.length} ${salesPeople.length === 1 ? "osoba" : "osób"}).`}
                    tone="slate"
                    size="md"
                    ariaLabel="O polu handlowca"
                  />
                </>
              }
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
            <Field labelClassName="inline-flex min-h-6 items-center" label="Dostawca">
              <SupplierPickerField
                suppliers={suppliers}
                value={supplierId}
                onChange={setSupplierId}
                allowEmpty={false}
                emptyLabel="Wybierz dostawcę"
                placeholder="Szukaj dostawcy…"
                showInlineFeedback={false}
                dropdownSize="comfortable"
              />
            </Field>
          </div>
        </ProsbaFormSection>

        <ProsbaFormProductsSection
          requestKind={requestKind}
          informacjaPath={informacjaPath}
        >
          <div className="space-y-3">
            <RequestProductLinesEditor
              lines={lines}
              onChange={(next) => {
                setFormNotice(null);
                setLines(next);
              }}
              requestKind={requestKind}
              appearance="prosba"
              showClientField
              addLabel="+ Kolejny produkt"
              suppliers={supplierRefs}
              unifiedFeedback
              typeaheadSize="comfortable"
              validationAttempted={validationAttempted}
              liveValidation
              onSupplierResolved={({ supplierId: id }) => {
                setSupplierId(id);
              }}
              onSupplierMappingMissing={() => setSupplierId("")}
              onResolvingSupplierChange={setResolvingSupplier}
            />

            <ProsbaFormReadiness
              lines={readinessLines}
              requestKind={requestKind}
              salesSubmitPlan={prosbaReadiness.plan}
              formMessage={formNotice}
              resolvingSupplier={resolvingSupplier}
              informacjaPath={informacjaPath}
              validationAttempted={validationAttempted}
            />
          </div>
        </ProsbaFormProductsSection>
      </div>
    </ModalShell>
    </>
  );
}
