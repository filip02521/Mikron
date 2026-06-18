"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IndividualRequestKind } from "@/types/database";
import { actionUpdateIndividualRequest } from "@/app/actions/admin";
import { actionUpdateMyIndividualRequest } from "@/app/actions/my-orders";
import { assessSalesGroupSubmittable } from "@/lib/orders/sales-request-submit";
import {
  assessRequestCompleteness,
  hasValidOrderQuantity,
} from "@/lib/orders/request-completeness";
import { assertProcurementEntryComplete } from "@/lib/orders/procurement-submit";
import {
  editRequestNoteForSave,
  filterIndividualRequestEditLinesForSave,
  toIndividualRequestEditLinePayload,
} from "@/lib/orders/individual-request-edit";
import { PROCUREMENT_TEAM_LABEL } from "@/lib/orders/procurement-copy";
import { buildProsbaFormReadiness } from "@/lib/orders/prosba-form-readiness";
import { ProsbaFormReadiness } from "@/components/orders/ProsbaFormReadiness";
import { ProsbaFormSection } from "@/components/orders/ProsbaFormSection";
import { RequestFormStatusPanel } from "@/components/orders/RequestFormStatusPanel";
import { RequestProductLinesEditor } from "@/components/orders/RequestProductLinesEditor";
import { SalesRequestNoteField } from "@/components/orders/SalesRequestNoteField";
import { newProductLine, appendProductLine, type ProductLineDraft } from "@/components/orders/request-product-lines";
import { RequestKindToggle } from "@/components/orders/RequestKindToggle";
import { InformacjaFlowPicker } from "@/components/orders/InformacjaFlowPicker";
import {
  DEFAULT_INFORMACJA_FLOW_PATH,
  INFORMACJA_FLOW_PICKER_SECTION,
  INFORMACJA_FLOW_PICKER_SECTION_DAILY,
  informacjaProductsFormHint,
} from "@/lib/orders/informacja-flow-ui";
import {
  flagsFromInformacjaFlowPath,
  type InformacjaFlowPath,
} from "@/lib/orders/informacja-stock-out-reorder";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { SupplierPickerField } from "@/components/orders/SupplierPickerField";
import { KeyboardShortcutsHint } from "@/components/ui/KeyboardShortcutsHint";
import { useActionPending } from "@/hooks/useActionPending";
import { toAppSupplierRefs } from "@/lib/subiekt/match-supplier";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import {
  handleProcurementProsbaKeyboardEvent,
  PROCUREMENT_PROSBA_KEYBOARD_HINTS,
} from "@/lib/orders/procurement-prosba-keyboard";
import { ProsbaStockConfirmDialog } from "@/components/orders/ProsbaStockConfirmDialog";
import { buildProsbaSubmitStockConfirm } from "@/lib/orders/prosba-stock-check";
import { handleProsbaStockSubmitError } from "@/lib/orders/prosba-stock-submit-error";

export type EditIndividualRequestInitial = {
  supplierId: string;
  salesPersonId: string;
  requestKind: IndividualRequestKind;
  informacjaPath?: InformacjaFlowPath;
  requestNote?: string | null;
  requestNotesMixed?: boolean;
  lines: ProductLineDraft[];
};

export function EditIndividualRequestModal({
  open,
  onClose,
  mode,
  orderIds,
  initial,
  suppliers,
  salesPeople = [],
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  mode: "procurement" | "sales";
  orderIds: string[];
  initial: EditIndividualRequestInitial | null;
  suppliers: OrderFormSupplierOption[];
  salesPeople?: { id: string; name: string }[];
  onSaved?: (message: string) => void;
}) {
  const { pending, pendingMessage, run } = useActionPending();
  const [supplierId, setSupplierId] = useState("");
  const [salesPersonId, setSalesPersonId] = useState("");
  const [requestKind, setRequestKind] = useState<IndividualRequestKind>("zamowienie");
  const [informacjaPath, setInformacjaPath] = useState<InformacjaFlowPath>(
    DEFAULT_INFORMACJA_FLOW_PATH
  );
  const [lines, setLines] = useState<ProductLineDraft[]>([newProductLine()]);
  const [requestNote, setRequestNote] = useState("");
  const [requestNoteTouched, setRequestNoteTouched] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [formNotice, setFormNotice] = useState<{
    text: string;
    tone: "error" | "warning";
  } | null>(null);
  const [stockConfirmOpen, setStockConfirmOpen] = useState(false);
  const [stockConfirmMessage, setStockConfirmMessage] = useState("");
  const pendingSaveLinesRef = useRef<ProductLineDraft[]>([]);

  const sortedSuppliers = useMemo(
    () => [...suppliers].sort((a, b) => a.name.localeCompare(b.name, "pl")),
    [suppliers]
  );
  const supplierRefs = useMemo(() => toAppSupplierRefs(suppliers), [suppliers]);
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

  const salesSubmitPlan = useMemo(() => {
    if (mode !== "sales") return null;
    return assessSalesGroupSubmittable(lines, "", requestKind);
  }, [mode, lines, requestKind]);

  const salesFormReadiness = useMemo(() => {
    if (mode !== "sales") return null;
    return buildProsbaFormReadiness(lines, requestKind, salesSubmitPlan, {
      informacjaPath,
      resolvingSupplier,
    });
  }, [mode, lines, requestKind, salesSubmitPlan, informacjaPath, resolvingSupplier]);

  const canSaveSales = salesFormReadiness?.canSubmit ?? false;

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

  const resetKey =
    open && initial
      ? [
          initial.supplierId,
          initial.salesPersonId,
          initial.requestKind,
          initial.informacjaPath ?? DEFAULT_INFORMACJA_FLOW_PATH,
          initial.requestNote ?? "",
          String(initial.requestNotesMixed ?? false),
          ...initial.lines.map((line) => line.id),
        ].join("\0")
      : "";
  const [appliedResetKey, setAppliedResetKey] = useState("");
  if (open && initial) {
    if (resetKey !== appliedResetKey) {
      setAppliedResetKey(resetKey);
      setSupplierId(initial.supplierId);
      setSalesPersonId(initial.salesPersonId);
      setRequestKind(initial.requestKind);
      setInformacjaPath(initial.informacjaPath ?? DEFAULT_INFORMACJA_FLOW_PATH);
      setLines(
        initial.lines.length > 0
          ? initial.lines.map((line) => ({ ...line }))
          : [newProductLine()]
      );
      setRequestNote(initial.requestNote ?? "");
      setRequestNoteTouched(false);
      setValidationAttempted(false);
      setFormNotice(null);
      setSupplierSubiektFeedback(null);
      setSupplierPickerFeedbacks([]);
      setProductLineFeedback(null);
      setConfigFeedback(null);
      setResolvingSupplier(false);
    }
  } else if (appliedResetKey) {
    setAppliedResetKey("");
  }

  const saveRef = useRef<() => void>(() => {});
  const addLineRef = useRef<() => void>(() => {});

  const save = () => {
    if (!initial) return;
    setFormNotice(null);

    const linesToSave = filterIndividualRequestEditLinesForSave(lines, orderIds, {
      supplierId: mode === "procurement" ? supplierId : "",
    });
    if (!linesToSave.length) {
      setValidationAttempted(true);
      setFormNotice({
        text: "Dodaj co najmniej jedną pozycję z produktem.",
        tone: "error",
      });
      return;
    }

    if (mode === "procurement") {
      if (requestKind === "zamowienie" && !supplierId.trim()) {
        setValidationAttempted(true);
        setFormNotice({ text: "Wybierz dostawcę.", tone: "error" });
        return;
      }
      try {
        for (const line of linesToSave) {
          assertProcurementEntryComplete({
            supplierId,
            symbol: line.symbol,
            mikranCode: line.mikranCode,
            product: line.product,
            quantity: line.quantity,
            requestKind,
            subiektTwId: line.subiektTwId,
            ...informacjaFlags,
          });
        }
      } catch (e) {
        setValidationAttempted(true);
        setFormNotice({
          text: e instanceof Error ? e.message : "Uzupełnij wymagane pola.",
          tone: "error",
        });
        return;
      }
    }

    if (mode === "sales") {
      const plan = assessSalesGroupSubmittable(linesToSave, "", requestKind);
      if (!plan?.submittable) {
        setValidationAttempted(true);
        setFormNotice({
          text:
            requestKind === "informacja"
              ? "Uzupełnij wymagane pola — symbol, kod Mikran lub opis produktu."
              : "Uzupełnij wymagane pola — produkt i ilość przy każdej pozycji.",
          tone: "error",
        });
        return;
      }
      if (
        requestKind === "zamowienie" &&
        linesToSave.some(
          (l) =>
            (l.symbol.trim() || l.mikranCode.trim() || l.product.trim()) &&
            !hasValidOrderQuantity(l.quantity, "zamowienie")
        )
      ) {
        setValidationAttempted(true);
        setFormNotice({
          text: "Każda pozycja zamówienia musi mieć ilość (liczba sztuk, np. 1).",
          tone: "error",
        });
        return;
      }
    }

    const stockConfirm = buildProsbaSubmitStockConfirm(linesToSave, requestKind);
    if (stockConfirm) {
      pendingSaveLinesRef.current = linesToSave;
      setStockConfirmMessage(stockConfirm.message);
      setStockConfirmOpen(true);
      return;
    }

    performSave(linesToSave);
  };

  const performSave = (
    linesToSave: ProductLineDraft[],
    options?: { acknowledgeSufficientStock?: boolean }
  ) => {
    if (!initial) return;
    run(
      async () => {
        try {
          const payload = {
            supplierId: mode === "sales" ? "" : supplierId,
            salesPersonId,
            requestKind,
            informacjaPath:
              requestKind === "informacja" ? informacjaPath : undefined,
            requestNote: editRequestNoteForSave(requestNote, {
              mixedOnLines: Boolean(initial?.requestNotesMixed),
              touched: requestNoteTouched,
              initialNote: initial?.requestNote ?? "",
            }),
            lines: linesToSave.map((line) =>
              toIndividualRequestEditLinePayload(line, orderIds)
            ),
            acknowledgeSufficientStock: options?.acknowledgeSufficientStock,
          };
          if (mode === "procurement") {
            await actionUpdateIndividualRequest(orderIds, payload);
          } else {
            await actionUpdateMyIndividualRequest(orderIds, payload);
          }
          onSaved?.("Zapisano zmiany w prośbie.");
          onClose();
          setStockConfirmOpen(false);
        } catch (e) {
          handleProsbaStockSubmitError(
            e,
            (message) => {
              setStockConfirmMessage(message);
              setStockConfirmOpen(true);
            },
            (message) => {
              setValidationAttempted(true);
              setFormNotice({ text: message, tone: "error" });
            }
          );
        }
      },
      "Zapisywanie prośby…"
    );
  };
  useEffect(() => {
    saveRef.current = save;
    addLineRef.current = () => setLines((prev) => appendProductLine(prev));
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      handleProcurementProsbaKeyboardEvent(e, {
        pending,
        onSubmit: () => saveRef.current(),
        onSetRequestKind: mode === "procurement" ? setRequestKind : undefined,
        onAddProductLine: () => addLineRef.current(),
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, mode]);

  if (!open) return null;

  return (
    <>
      <ProsbaStockConfirmDialog
        open={stockConfirmOpen}
        message={stockConfirmMessage}
        pending={pending}
        confirmLabel="Zapisz mimo to"
        onCancel={() => {
          setStockConfirmOpen(false);
          pendingSaveLinesRef.current = [];
        }}
        onConfirm={() =>
          performSave(pendingSaveLinesRef.current, { acknowledgeSufficientStock: true })
        }
      />
    <ModalShell
      open
      onClose={onClose}
      title={mode === "procurement" ? "Popraw prośbę handlowca" : "Popraw swoją prośbę"}
      description={
        mode === "procurement"
          ? "Korekta przed złożeniem zamówienia u dostawcy — np. zły dostawca lub opis produktu."
          : `Możesz poprawić prośbę, dopóki ${PROCUREMENT_TEAM_LABEL} nie oznaczy jej jako zamówionej.`
      }
      size="xl"
      tier="raised"
      className="max-h-[min(calc(100dvh-1rem),920px)]"
      loadingMessage={pendingMessage}
      disableBackdropClose={pending}
      bodyClassName="flex min-h-0 flex-1 flex-col"
      footer={
        <>
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            Anuluj
          </Button>
          <Button
            disabled={pending || !initial || (mode === "sales" && !canSaveSales)}
            title={
              mode === "sales" && !canSaveSales && !pending
                ? "Uzupełnij wymagane pola przed zapisem"
                : undefined
            }
            onClick={save}
          >
            Zapisz zmiany
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-100 bg-slate-50/60 px-5 py-2.5 sm:px-6">
        <span className="shrink-0 text-xs font-medium text-slate-600">Skróty klawiszowe</span>
        <KeyboardShortcutsHint items={[...PROCUREMENT_PROSBA_KEYBOARD_HINTS]} compact />
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
        {mode === "procurement" ? (
          <ProsbaFormSection
            title="Dla kogo i u kogo?"
            hint="Handlowiec i dostawca przypisany do prośby."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Dostawca">
                <SupplierPickerField
                  suppliers={sortedSuppliers}
                  value={supplierId}
                  onChange={setSupplierId}
                  disabled={pending}
                  allowEmpty
                  emptyLabel="— wybierz —"
                  dropdownSize="comfortable"
                  showInlineFeedback={false}
                  onSubiektFeedbackChange={setSupplierPickerFeedbacks}
                />
              </Field>
              {salesPeople.length > 0 ? (
                <Field label="Handlowiec">
                  <Select
                    disabled={pending}
                    value={salesPersonId}
                    onChange={(e) => setSalesPersonId(e.target.value)}
                  >
                    {salesPeople.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
            </div>
          </ProsbaFormSection>
        ) : (
          <p className="text-xs leading-relaxed text-slate-500">
            Dostawcę dopasujemy z Subiekta po zapisie (jeśli wybrałeś towar z katalogu) albo
            uzupełni go {PROCUREMENT_TEAM_LABEL}.
          </p>
        )}

        <ProsbaFormSection
          title="Co chcesz zgłosić?"
          hint="Rodzaj prośby decyduje o wymaganych polach produktu."
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
            title={INFORMACJA_FLOW_PICKER_SECTION.title}
            hint={
              mode === "procurement" && informacjaPath === "via_panel"
                ? INFORMACJA_FLOW_PICKER_SECTION_DAILY.hint
                : INFORMACJA_FLOW_PICKER_SECTION.hint
            }
          >
            <InformacjaFlowPicker
              path={informacjaPath}
              onChange={setInformacjaPath}
              disabled={pending}
              includeViaPanel={mode === "procurement" && informacjaPath === "via_panel"}
            />
          </ProsbaFormSection>
        ) : null}

        <ProsbaFormSection
          title="Produkty"
          hint={
            requestKind === "informacja"
              ? informacjaProductsFormHint(informacjaPath)
              : mode === "sales"
                ? "Symbol, kod Mikran lub opis oraz ilość przy każdej pozycji."
                : "Symbol, kod Mikran lub opis, ilość oraz opcjonalnie klient końcowy (Subiekt) przy każdej pozycji."
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
              showClientField
              deferSupplierResolve={mode === "sales"}
              typeaheadSize="comfortable"
              validationAttempted={validationAttempted}
              liveValidation={mode === "sales"}
              suppliers={mode === "procurement" ? supplierRefs : undefined}
              unifiedFeedback={mode === "procurement"}
              onSupplierResolved={
                mode === "procurement"
                  ? ({ supplierId: id }) => {
                      setSupplierId(id);
                      setSupplierSubiektFeedback(null);
                    }
                  : undefined
              }
              onSupplierMappingMissing={
                mode === "procurement" ? () => setSupplierId("") : undefined
              }
              onSupplierResolveFeedback={
                mode === "procurement" ? setSupplierSubiektFeedback : undefined
              }
              onProductFeedbackChange={
                mode === "procurement" ? setProductLineFeedback : undefined
              }
              onConfigFeedbackChange={
                mode === "procurement" ? setConfigFeedback : undefined
              }
              onResolvingSupplierChange={
                mode === "procurement" ? setResolvingSupplier : undefined
              }
            />

            <SalesRequestNoteField
              value={requestNote}
              onChange={(value) => {
                setFormNotice(null);
                setRequestNoteTouched(true);
                setRequestNote(value);
              }}
              disabled={pending}
              mixedNotesOnLines={initial?.requestNotesMixed}
              audience={mode}
              id={mode === "procurement" ? "procurement-edit-request-note" : "sales-edit-request-note"}
            />

            {mode === "sales" ? (
              <ProsbaFormReadiness
                lines={lines}
                requestKind={requestKind}
                salesSubmitPlan={salesSubmitPlan}
                formMessage={formNotice}
                informacjaPath={informacjaPath}
              />
            ) : (
              <RequestFormStatusPanel
                requestKind={requestKind}
                audience="procurement"
                draft={{
                  supplierId,
                  symbol: lines.find((l) => l.symbol.trim())?.symbol,
                  mikranCode: lines.find((l) => l.mikranCode.trim())?.mikranCode,
                  product: lines.find((l) => l.product.trim())?.product,
                  quantity: lines.find((l) => l.quantity.trim())?.quantity,
                  requestKind,
                  ...informacjaFlags,
                }}
                forcedAssessment={
                  requestKind === "zamowienie"
                    ? assessRequestCompleteness({
                        supplierId,
                        symbol: lines.find((l) => l.symbol.trim())?.symbol,
                        mikranCode: lines.find((l) => l.mikranCode.trim())?.mikranCode,
                        product: lines.find((l) => l.product.trim())?.product,
                        quantity: lines.find((l) => l.quantity.trim())?.quantity,
                        requestKind,
                      })
                    : undefined
                }
                subiektFeedbacks={[
                  configFeedback,
                  ...supplierPickerFeedbacks,
                  supplierSubiektFeedback,
                  productLineFeedback,
                ]}
                resolvingSupplier={resolvingSupplier}
                validationAttempted={validationAttempted}
                formMessage={formNotice}
              />
            )}
          </div>
        </ProsbaFormSection>
      </div>
    </ModalShell>
    </>
  );
}
