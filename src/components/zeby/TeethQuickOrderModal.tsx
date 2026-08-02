"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionAddIndividualOrders } from "@/app/actions/admin";
import { ACTION_PENDING_SAFETY_FORM_MS } from "@/lib/timing";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { HelpHintBubble } from "@/components/ui/HelpHintBubble";
import { IconTooth, IconUserGroup } from "@/components/icons/StrokeIcons";
import { SupplierPickerField } from "@/components/orders/SupplierPickerField";
import { ProsbaFormReadiness } from "@/components/orders/ProsbaFormReadiness";
import { ProsbaFormProductsSection } from "@/components/orders/ProsbaFormSharedSections";
import { ProsbaFormSection } from "@/components/orders/ProsbaFormSection";
import { ModalShell } from "@/components/ui/ModalShell";
import { hasValidOrderQuantity } from "@/lib/orders/request-completeness";
import { assertProcurementEntryComplete } from "@/lib/orders/procurement-submit";
import {
  RequestProductLinesEditor,
  initialProductLines,
} from "@/components/orders/RequestProductLinesEditor";
import { toAppSupplierRefs } from "@/lib/subiekt/match-supplier";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";
import { buildProsbaFormReadinessWithSupplier } from "@/lib/orders/prosba-form-readiness";
import { PROSBA_FORM_SECTION_COPY } from "@/lib/orders/prosba-form-section-copy";
import { TEETH_ALLOWED_TW_IDS_HINT } from "@/lib/orders/zk-prosba-link-banner-copy";
import { prosbaLineHasTeethBlockers } from "@/lib/orders/prosba-line-field-validation";
import type { FormMessage } from "@/lib/ui/notice-content";
import { formError, QUICK_ORDER_FORM } from "@/lib/ui/notice-copy";
import {
  classifyProsbaLinesByLane,
  procurementSubmitSuccessMessage,
  prosbaLineIsTeethProduct,
} from "@/lib/teeth/teeth-procurement-flow-copy";
import { useTeethExemptTwIds } from "@/components/layout/TeethExemptContext";
import type { AddIndividualOrdersEntry } from "@/lib/orders/individual-request-edit";
import { TEETH_QUICK_ORDER_COPY } from "@/components/zeby/teeth-panel-copy";

export function TeethQuickOrderModal({
  open,
  onClose,
  suppliers,
  salesPeople,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  suppliers: OrderFormSupplierOption[];
  salesPeople: { id: string; name: string; email: string }[];
  onCreated?: () => void;
}) {
  const router = useRouter();
  const teethExemptTwIds = useTeethExemptTwIds();
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const pendingSafetyRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pendingSafetyRef.current) window.clearTimeout(pendingSafetyRef.current);
    };
  }, []);

  const requestKind = "zamowienie" as const;
  const [supplierId, setSupplierId] = useState("");
  const [salesPersonId, setSalesPersonId] = useState("");
  const [lines, setLines] = useState(initialProductLines);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [formNotice, setFormNotice] = useState<FormMessage | null>(null);
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
        clientName: l.clientName,
        clientKhId: l.clientKhId,
        teethDetails: l.teethDetails,
        teethManufacturer: l.teethManufacturer,
        teethProductLine: l.teethProductLine,
      })),
    [lines, supplierId]
  );

  const prosbaReadiness = useMemo(
    () =>
      buildProsbaFormReadinessWithSupplier(readinessLines, supplierId, requestKind, {
        resolvingSupplier,
        teethExemptTwIds,
      }),
    [readinessLines, supplierId, resolvingSupplier, teethExemptTwIds]
  );

  const canSubmitProsba =
    Boolean(salesPersonId.trim()) &&
    Boolean(supplierId.trim()) &&
    prosbaReadiness.view.canSubmit &&
    !resolvingSupplier &&
    teethExemptTwIds.size > 0;

  const reset = () => {
    setSupplierId("");
    setSalesPersonId("");
    setLines(initialProductLines());
    setValidationAttempted(false);
    setFormNotice(null);
    setResolvingSupplier(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const performSubmit = (entries: AddIndividualOrdersEntry[]) => {
    setPendingMessage("Zapisywanie prośby zębowej…");
    if (pendingSafetyRef.current) window.clearTimeout(pendingSafetyRef.current);
    pendingSafetyRef.current = window.setTimeout(() => setPendingMessage(null), ACTION_PENDING_SAFETY_FORM_MS);
    start(async () => {
      try {
        const r = await actionAddIndividualOrders({ entries });
        const lanes = classifyProsbaLinesByLane(entries, teethExemptTwIds);
        setFormNotice({
          text: procurementSubmitSuccessMessage({
            count: r.count,
            requestKind,
            lanes,
          }),
          tone: "success",
        });
        onCreated?.();
        router.refresh();
        setTimeout(() => {
          handleClose();
        }, 600);
      } catch (e) {
        setFormNotice(
          formError(
            "Nie udało się wysłać",
            e instanceof Error ? e.message : "Spróbuj ponownie za chwilę."
          )
        );
      } finally {
        if (pendingSafetyRef.current) {
          window.clearTimeout(pendingSafetyRef.current);
          pendingSafetyRef.current = null;
        }
        setPendingMessage(null);
      }
    });
  };

  const submit = () => {
    setFormNotice(null);
    setValidationAttempted(false);
    if (!supplierId || !salesPersonId) {
      setValidationAttempted(true);
      setFormNotice(QUICK_ORDER_FORM.missingSupplierAndSales);
      return;
    }
    if (teethExemptTwIds.size === 0) {
      setValidationAttempted(true);
      setFormNotice(TEETH_QUICK_ORDER_COPY.emptyCatalog);
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
        quantity: l.quantity,
        requestKind,
        subiektTwId: l.subiektTwId,
        onHand: l.onHand,
        reserved: l.reserved,
        available: l.available,
        stockSource: l.stockSource,
        clientName: l.clientName,
        clientKhId: l.clientKhId,
        requestNote: l.requestNote?.trim() || undefined,
        teethDetails: l.teethDetails ?? undefined,
      }));
    if (!entries.length) {
      setValidationAttempted(true);
      setFormNotice(QUICK_ORDER_FORM.missingProducts);
      return;
    }
    if (entries.some((e) => !hasValidOrderQuantity(e.quantity, "zamowienie"))) {
      setValidationAttempted(true);
      setFormNotice(QUICK_ORDER_FORM.missingQuantity);
      return;
    }
    if (entries.some((e) => !prosbaLineIsTeethProduct(e, teethExemptTwIds))) {
      setValidationAttempted(true);
      setFormNotice(TEETH_QUICK_ORDER_COPY.nonTeethProduct);
      return;
    }
    if (
      lines.some((line) =>
        prosbaLineHasTeethBlockers(line, requestKind, { exemptTwIds: teethExemptTwIds })
      )
    ) {
      setValidationAttempted(true);
      setFormNotice(QUICK_ORDER_FORM.teethListIncomplete);
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
      setValidationAttempted(true);
      setFormNotice(
        err instanceof Error
          ? { ...QUICK_ORDER_FORM.incompleteFields, text: err.message }
          : QUICK_ORDER_FORM.incompleteFields
      );
      return;
    }
    performSubmit(entries);
  };

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title={TEETH_QUICK_ORDER_COPY.title}
      titleHint={TEETH_QUICK_ORDER_COPY.titleHint}
      titleHintAriaLabel="O formularzu prośby zębowej"
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
            {pending ? "Zapisywanie…" : TEETH_QUICK_ORDER_COPY.submitLabel}
          </Button>
        </>
      }
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-sm text-indigo-900">
          <p className="flex items-start gap-2 font-medium">
            <IconTooth size={16} className="mt-0.5 shrink-0" aria-hidden />
            {TEETH_QUICK_ORDER_COPY.banner}
          </p>
        </div>

        <ProsbaFormSection
          title={PROSBA_FORM_SECTION_COPY.delegateProcurement.title}
          hint={TEETH_QUICK_ORDER_COPY.delegateHint}
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
          informacjaPath="direct"
          hint="Szukaj wyłącznie w katalogu zębów — po wyborze uzupełnij listę zębów."
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
              addLabel="+ Kolejny produkt zębowy"
              suppliers={supplierRefs}
              unifiedFeedback
              typeaheadSize="comfortable"
              validationAttempted={validationAttempted}
              liveValidation
              allowedTwIds={teethExemptTwIds}
              allowedTwIdsHint={TEETH_ALLOWED_TW_IDS_HINT}
              groupSupplierId={supplierId}
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
              supplierId={supplierId}
              resolvingSupplier={resolvingSupplier}
              validationAttempted={validationAttempted}
              teethExemptTwIds={teethExemptTwIds}
            />
          </div>
        </ProsbaFormProductsSection>
      </div>
    </ModalShell>
  );
}
