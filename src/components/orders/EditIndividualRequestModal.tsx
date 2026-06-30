"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TeethLineDetail } from "@/lib/teeth/teeth-catalog";
import type { IndividualRequestKind } from "@/types/database";
import { actionUpdateIndividualRequest } from "@/app/actions/admin";
import { actionUpdateMyIndividualRequest } from "@/app/actions/my-orders";
import { assessSalesGroupSubmittable } from "@/lib/orders/sales-request-submit";
import {
  hasValidOrderQuantity,
} from "@/lib/orders/request-completeness";
import { assertProcurementEntryComplete } from "@/lib/orders/procurement-submit";
import {
  filterIndividualRequestEditLinesForSave,
  toIndividualRequestEditLinePayload,
} from "@/lib/orders/individual-request-edit";
import { buildProsbaFormReadiness, buildProsbaFormReadinessWithSupplier } from "@/lib/orders/prosba-form-readiness";
import { prosbaLineHasTeethBlockers } from "@/lib/orders/prosba-line-field-validation";
import { TEETH_LIST_INCOMPLETE_MESSAGE } from "@/lib/teeth/teeth-validation";
import { ProsbaFormReadiness } from "@/components/orders/ProsbaFormReadiness";
import {
  ProsbaFormInformacjaSection,
  ProsbaFormKeyboardStrip,
  ProsbaFormProductsSection,
  ProsbaFormRequestKindSection,
} from "@/components/orders/ProsbaFormSharedSections";
import { ProsbaFormSection } from "@/components/orders/ProsbaFormSection";
import { RequestProductLinesEditor } from "@/components/orders/RequestProductLinesEditor";
import { newProductLine, appendProductLine, type ProductLineDraft } from "@/components/orders/request-product-lines";
import { IconUserGroup } from "@/components/icons/StrokeIcons";
import {
  DEFAULT_INFORMACJA_FLOW_PATH,
  informacjaProductsFormHint,
} from "@/lib/orders/informacja-flow-ui";
import { PROSBA_FORM_SECTION_COPY } from "@/lib/orders/prosba-form-section-copy";
import { PROSBA_PAGE_HEADER_HINTS } from "@/lib/orders/prosba-optional-section-copy";
import {
  flagsFromInformacjaFlowPath,
  type InformacjaFlowPath,
} from "@/lib/orders/informacja-stock-out-reorder";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { SupplierPickerField } from "@/components/orders/SupplierPickerField";
import { useActionPending } from "@/hooks/useActionPending";
import { toAppSupplierRefs } from "@/lib/subiekt/match-supplier";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";
import {
  handleProcurementProsbaKeyboardEvent,
  PROCUREMENT_PROSBA_KEYBOARD_HINTS,
} from "@/lib/orders/procurement-prosba-keyboard";
import {
  handleSalesProsbaKeyboardEvent,
  SALES_PROSBA_KEYBOARD_HINTS,
} from "@/lib/orders/sales-prosba-keyboard";
import { ProsbaStockConfirmDialog } from "@/components/orders/ProsbaStockConfirmDialog";
import { buildProsbaSubmitStockConfirm } from "@/lib/orders/prosba-stock-check";
import { handleProsbaStockSubmitError } from "@/lib/orders/prosba-stock-submit-error";
import { useTeethExemptTwIds, useTeethProductInfo } from "@/components/layout/TeethExemptContext";

export type EditIndividualRequestInitial = {
  supplierId: string;
  salesPersonId: string;
  requestKind: IndividualRequestKind;
  informacjaPath?: InformacjaFlowPath;
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
  autoSaveAfterTeethList = false,
}: {
  open: boolean;
  onClose: () => void;
  mode: "procurement" | "sales";
  orderIds: string[];
  initial: EditIndividualRequestInitial | null;
  suppliers: OrderFormSupplierOption[];
  salesPeople?: { id: string; name: string }[];
  onSaved?: (message: string) => void;
  /** Po „Zapisz listę” w modalu zębów od razu zapisuje prośbę (panel zębów). */
  autoSaveAfterTeethList?: boolean;
}) {
  const { pending, pendingMessage, run } = useActionPending();
  const teethExemptTwIds = useTeethExemptTwIds();
  const teethProductInfo = useTeethProductInfo();
  const [supplierId, setSupplierId] = useState("");
  const [salesPersonId, setSalesPersonId] = useState("");
  const [requestKind, setRequestKind] = useState<IndividualRequestKind>("zamowienie");
  const [informacjaPath, setInformacjaPath] = useState<InformacjaFlowPath>(
    DEFAULT_INFORMACJA_FLOW_PATH
  );
  const [lines, setLines] = useState<ProductLineDraft[]>([newProductLine()]);
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
      teethExemptTwIds,
    });
  }, [mode, lines, requestKind, salesSubmitPlan, informacjaPath, resolvingSupplier, teethExemptTwIds]);

  const canSaveSales = salesFormReadiness?.canSubmit ?? false;

  const procurementReadiness = useMemo(() => {
    if (mode !== "procurement") return null;
    return buildProsbaFormReadinessWithSupplier(lines, supplierId, requestKind, {
      informacjaPath,
      resolvingSupplier,
      teethExemptTwIds,
    });
  }, [mode, lines, supplierId, requestKind, informacjaPath, resolvingSupplier, teethExemptTwIds]);

  const canSaveProcurement =
    mode === "procurement" &&
    Boolean(supplierId.trim()) &&
    Boolean(salesPersonId.trim()) &&
    (procurementReadiness?.view.canSubmit ?? false) &&
    !resolvingSupplier;

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
          ...initial.lines.map(
            (line) =>
              `${line.id}\0${line.requestNote ?? ""}\0${line.product}\0${line.teethDetails?.length ?? 0}\0${line.teethDetails?.map((d) => `${d.color}|${d.mould}|${d.jaw}|${d.kind}`).join(";") ?? ""}`
          ),
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
          ? initial.lines.map((line) => {
              const twId = line.subiektTwId;
              const isTeeth = twId != null && twId > 0 && teethProductInfo.twIds.has(twId);
              const detectedManufacturer = isTeeth
                ? (teethProductInfo.manufacturerByTwId.get(twId!) ?? null)
                : null;
              const detectedKind = isTeeth
                ? (teethProductInfo.kindByTwId.get(twId!) ?? null)
                : null;
              const detectedProductLine = isTeeth
                ? (teethProductInfo.productLineByTwId.get(twId!) ?? null)
                : null;
              return {
                ...line,
                teethManufacturer: line.teethManufacturer ?? detectedManufacturer,
                teethProductLine: line.teethProductLine ?? detectedProductLine,
                teethKind: line.teethKind ?? detectedKind,
              };
            })
          : [newProductLine()]
      );
      setValidationAttempted(false);
      setFormNotice(null);
      setResolvingSupplier(false);
    }
  } else if (appliedResetKey) {
    setAppliedResetKey("");
  }

  const saveRef = useRef<() => void>(() => {});
  const addLineRef = useRef<() => void>(() => {});
  const performSaveRef = useRef<
    (linesToSave: ProductLineDraft[], options?: { acknowledgeSufficientStock?: boolean }) => void
  >(() => {});

  const performSave = useCallback(
    (
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
    },
    [
      initial,
      run,
      mode,
      supplierId,
      salesPersonId,
      requestKind,
      informacjaPath,
      orderIds,
      onSaved,
      onClose,
    ]
  );

  useEffect(() => {
    performSaveRef.current = performSave;
  }, [performSave]);

  const submitLines = useCallback(
    (sourceLines: ProductLineDraft[]) => {
      if (!initial) return;
      setFormNotice(null);

      const linesToSave = filterIndividualRequestEditLinesForSave(sourceLines, orderIds, {
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

      if (
        requestKind === "zamowienie" &&
        linesToSave.some((line) =>
          prosbaLineHasTeethBlockers(line, requestKind, { exemptTwIds: teethExemptTwIds })
        )
      ) {
        setValidationAttempted(true);
        setFormNotice({ text: TEETH_LIST_INCOMPLETE_MESSAGE, tone: "error" });
        return;
      }

      const stockConfirm = buildProsbaSubmitStockConfirm(
        linesToSave,
        requestKind,
        teethExemptTwIds
      );
      if (stockConfirm) {
        pendingSaveLinesRef.current = linesToSave;
        setStockConfirmMessage(stockConfirm.message);
        setStockConfirmOpen(true);
        return;
      }

      performSaveRef.current(linesToSave);
    },
    [
      initial,
      orderIds,
      mode,
      supplierId,
      requestKind,
      informacjaFlags,
      teethExemptTwIds,
    ]
  );

  const handleAfterTeethListSave = useCallback(
    (lineIndex: number, teethDetails: TeethLineDetail[], totalQuantity: number) => {
      if (!autoSaveAfterTeethList || pending) return;
      const nextLines = lines.map((line, index) =>
        index === lineIndex
          ? { ...line, teethDetails, quantity: String(totalQuantity) }
          : line
      );
      setLines(nextLines);
      submitLines(nextLines);
    },
    [autoSaveAfterTeethList, lines, submitLines, pending],
  );

  const save = () => {
    submitLines(lines);
  };

  useEffect(() => {
    saveRef.current = save;
    addLineRef.current = () => setLines((prev) => appendProductLine(prev));
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (mode === "sales") {
        handleSalesProsbaKeyboardEvent(e, {
          pending,
          canSubmit: canSaveSales,
          onSubmit: () => saveRef.current(),
          onSetRequestKind: (kind) => {
            setRequestKind(kind);
            if (kind === "informacja") setInformacjaPath(DEFAULT_INFORMACJA_FLOW_PATH);
            else setInformacjaPath("direct");
          },
          onAddProductLine: () => addLineRef.current(),
        });
        return;
      }
      handleProcurementProsbaKeyboardEvent(e, {
        pending,
        onSubmit: () => saveRef.current(),
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
  }, [open, pending, mode, canSaveSales]);

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
          performSaveRef.current(pendingSaveLinesRef.current, {
            acknowledgeSufficientStock: true,
          })
        }
      />
    <ModalShell
      open
      onClose={onClose}
      title={mode === "procurement" ? "Popraw prośbę handlowca" : "Popraw swoją prośbę"}
      titleHint={
        mode === "procurement"
          ? PROSBA_PAGE_HEADER_HINTS.editProcurement
          : PROSBA_PAGE_HEADER_HINTS.editSales
      }
      titleHintAriaLabel="O edycji prośby"
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
            disabled={
              pending ||
              !initial ||
              (mode === "sales" && !canSaveSales) ||
              (mode === "procurement" && !canSaveProcurement)
            }
            title={
              mode === "sales" && !canSaveSales && !pending
                ? "Uzupełnij wymagane pola przed zapisem"
                : mode === "procurement" && !canSaveProcurement && !pending
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
      <ProsbaFormKeyboardStrip
        hints={mode === "sales" ? SALES_PROSBA_KEYBOARD_HINTS : PROCUREMENT_PROSBA_KEYBOARD_HINTS}
        variant={mode === "sales" ? "sales" : "procurement"}
      />

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        {mode === "procurement" ? (
          <ProsbaFormSection
            title={PROSBA_FORM_SECTION_COPY.delegateProcurement.title}
            hint={PROSBA_FORM_SECTION_COPY.delegateProcurement.hint}
            accent="indigo"
            icon={<IconUserGroup size={17} />}
            tileClassName="bg-indigo-100 text-indigo-800"
          >
            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
              {salesPeople.length > 0 ? (
                <Field labelClassName="inline-flex min-h-6 items-center" label="Dla kogo (handlowiec)">
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
              <Field labelClassName="inline-flex min-h-6 items-center" label="Dostawca">
                <SupplierPickerField
                  suppliers={sortedSuppliers}
                  value={supplierId}
                  onChange={setSupplierId}
                  disabled={pending}
                  allowEmpty
                  emptyLabel="— wybierz —"
                  dropdownSize="comfortable"
                  showInlineFeedback={false}
                />
              </Field>
            </div>
          </ProsbaFormSection>
        ) : null}

        <ProsbaFormRequestKindSection
          value={requestKind}
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
            includeViaPanel={mode === "procurement"}
          />
        ) : null}

        <ProsbaFormProductsSection
          requestKind={requestKind}
          informacjaPath={informacjaPath}
          hint={
            requestKind === "informacja"
              ? informacjaProductsFormHint(informacjaPath)
              : mode === "sales"
                ? PROSBA_FORM_SECTION_COPY.products.salesEditHint
                : PROSBA_FORM_SECTION_COPY.products.orderHint
          }
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
              addLabel="+ Kolejny produkt"
              showClientField
              deferSupplierResolve={mode === "sales"}
              typeaheadSize="comfortable"
              validationAttempted={validationAttempted}
              liveValidation
              suppliers={mode === "procurement" ? supplierRefs : undefined}
              unifiedFeedback={mode === "procurement"}
              onSupplierResolved={
                mode === "procurement"
                  ? ({ supplierId: id }) => {
                      setSupplierId(id);
                    }
                  : undefined
              }
              onSupplierMappingMissing={
                mode === "procurement" ? () => setSupplierId("") : undefined
              }
              onResolvingSupplierChange={
                mode === "procurement" ? setResolvingSupplier : undefined
              }
              onAfterTeethListSave={
                autoSaveAfterTeethList ? handleAfterTeethListSave : undefined
              }
              autoOpenTeethList={autoSaveAfterTeethList && open}
            />

            <ProsbaFormReadiness
              lines={lines}
              requestKind={requestKind}
              salesSubmitPlan={
                mode === "sales" ? salesSubmitPlan : procurementReadiness?.plan ?? null
              }
              formMessage={formNotice}
              informacjaPath={informacjaPath}
              resolvingSupplier={resolvingSupplier}
              validationAttempted={validationAttempted}
            />
          </div>
        </ProsbaFormProductsSection>
      </div>
    </ModalShell>
    </>
  );
}
