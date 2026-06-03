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
import { PROCUREMENT_TEAM_LABEL } from "@/lib/orders/procurement-copy";
import { ProsbaFormReadiness } from "@/components/orders/ProsbaFormReadiness";
import { ProsbaFormSection } from "@/components/orders/ProsbaFormSection";
import { RequestFormStatusPanel } from "@/components/orders/RequestFormStatusPanel";
import { RequestProductLinesEditor } from "@/components/orders/RequestProductLinesEditor";
import { newProductLine, appendProductLine, type ProductLineDraft } from "@/components/orders/request-product-lines";
import { RequestKindToggle } from "@/components/orders/RequestKindToggle";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { SupplierPickerField } from "@/components/orders/SupplierPickerField";
import { KeyboardShortcutsHint } from "@/components/ui/KeyboardShortcutsHint";
import { useActionPending } from "@/hooks/useActionPending";
import { toAppSupplierRefs } from "@/lib/subiekt/match-supplier";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import {
  handleProcurementProsbaKeyboardEvent,
  PROCUREMENT_PROSBA_KEYBOARD_HINTS,
} from "@/lib/orders/procurement-prosba-keyboard";

export type EditIndividualRequestInitial = {
  supplierId: string;
  salesPersonId: string;
  requestKind: IndividualRequestKind;
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
  suppliers: { id: string; name: string }[];
  salesPeople?: { id: string; name: string }[];
  onSaved?: (message: string) => void;
}) {
  const { pending, pendingMessage, run } = useActionPending();
  const [supplierId, setSupplierId] = useState("");
  const [salesPersonId, setSalesPersonId] = useState("");
  const [requestKind, setRequestKind] = useState<IndividualRequestKind>("zamowienie");
  const [lines, setLines] = useState<ProductLineDraft[]>([newProductLine()]);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [formNotice, setFormNotice] = useState<{
    text: string;
    tone: "error" | "warning";
  } | null>(null);

  const sortedSuppliers = useMemo(
    () => [...suppliers].sort((a, b) => a.name.localeCompare(b.name, "pl")),
    [suppliers]
  );
  const supplierRefs = useMemo(() => toAppSupplierRefs(suppliers), [suppliers]);
  const [supplierResolveFeedback, setSupplierResolveFeedback] =
    useState<SubiektFeedback | null>(null);

  const salesSubmitPlan = useMemo(() => {
    if (mode !== "sales") return null;
    return assessSalesGroupSubmittable(lines, "", requestKind);
  }, [mode, lines, requestKind]);

  useEffect(() => {
    if (!open || !initial) return;
    setSupplierId(initial.supplierId);
    setSalesPersonId(initial.salesPersonId);
    setRequestKind(initial.requestKind);
    setLines(
      initial.lines.length > 0
        ? initial.lines.map((l) => ({ ...l }))
        : [newProductLine()]
    );
    setValidationAttempted(false);
    setFormNotice(null);
  }, [open, initial]);

  const saveRef = useRef<() => void>(() => {});
  const addLineRef = useRef<() => void>(() => {});

  const save = () => {
    if (!initial) return;
    setFormNotice(null);
    setValidationAttempted(false);

    if (mode === "procurement" && requestKind === "zamowienie") {
      if (!supplierId.trim()) {
        setValidationAttempted(true);
        setFormNotice({ text: "Wybierz dostawcę.", tone: "error" });
        return;
      }
      try {
        for (const line of lines) {
          assertProcurementEntryComplete({
            supplierId,
            symbol: line.symbol,
            mikranCode: line.mikranCode,
            product: line.product,
            quantity: line.quantity,
            requestKind,
            subiektTwId: line.subiektTwId,
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
      const plan = assessSalesGroupSubmittable(lines, "", requestKind);
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
        lines.some(
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

    run(
      async () => {
        const payload = {
          supplierId: mode === "sales" ? "" : supplierId,
          salesPersonId,
          requestKind,
          lines: lines.map((l) => ({
            id: l.id,
            symbol: l.symbol,
            mikranCode: l.mikranCode,
            product: l.product,
            quantity: l.quantity,
            clientName: l.clientName,
            clientKhId: l.clientKhId,
            subiektTwId: l.subiektTwId,
          })),
        };
        if (mode === "procurement") {
          await actionUpdateIndividualRequest(orderIds, payload);
        } else {
          await actionUpdateMyIndividualRequest(orderIds, payload);
        }
        onSaved?.("Zapisano zmiany w prośbie.");
        onClose();
      },
      "Zapisywanie prośby…"
    );
  };
  saveRef.current = save;
  addLineRef.current = () => setLines((prev) => appendProductLine(prev));

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
          <Button disabled={pending || !initial} onClick={save}>
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
          <RequestKindToggle value={requestKind} onChange={setRequestKind} />
        </ProsbaFormSection>

        <ProsbaFormSection
          title="Produkty"
          hint={
            requestKind === "informacja"
              ? "Symbol, kod Mikran lub opis — bez ilości."
              : "Symbol, kod Mikran lub opis oraz ilość przy każdej pozycji."
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
              showClientField={mode === "sales"}
              deferSupplierResolve={mode === "sales"}
              typeaheadSize="comfortable"
              validationAttempted={validationAttempted}
              suppliers={mode === "procurement" ? supplierRefs : undefined}
              onSupplierResolved={
                mode === "procurement"
                  ? ({ supplierId: id }) => {
                      setSupplierId(id);
                      setSupplierResolveFeedback(null);
                    }
                  : undefined
              }
              onSupplierMappingMissing={
                mode === "procurement" ? () => setSupplierId("") : undefined
              }
              onSupplierResolveFeedback={
                mode === "procurement" ? setSupplierResolveFeedback : undefined
              }
            />

            {mode === "sales" ? (
              <ProsbaFormReadiness
                lines={lines}
                requestKind={requestKind}
                salesSubmitPlan={salesSubmitPlan}
                formMessage={formNotice}
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
                subiektFeedbacks={supplierResolveFeedback ? [supplierResolveFeedback] : []}
                formMessage={formNotice}
              />
            )}
          </div>
        </ProsbaFormSection>
      </div>
    </ModalShell>
  );
}
