"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { SupplierPickerField } from "@/components/orders/SupplierPickerField";
import { actionSubiektSuggestProductsForZdLookup } from "@/app/actions/subiekt";
import { actionLookupProductZdDelivery } from "@/app/actions/product-zd-lookup";
import type { ProductZdLookupResult } from "@/lib/subiekt/product-zd-lookup";
import { DeliveryDateMetaValue } from "@/components/orders/DeliveryDateMetaValue";
import { DeliveryTimingMeta } from "@/components/orders/DeliveryTimingMeta";
import { SubiektFeedbackAlert } from "@/components/subiekt/SubiektFeedbackAlert";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import {
  TypeaheadDropdown,
  TypeaheadOption,
  TypeaheadSectionLabel,
  TYPEAHEAD_KEYBOARD_HINT,
} from "@/components/ui/TypeaheadDropdown";
import { IconCalendar, IconPackage, IconSearch } from "@/components/icons/StrokeIcons";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import { buildDeliveryDateMetaDisplay } from "@/lib/orders/delivery-date-meta-label";
import { parseDateOnly } from "@/lib/orders/dates";
import { ZD_DELIVERY_META_CAPTION } from "@/lib/orders/my-order-zd-fulfillment-display";
import {
  buildProductZdLookupLastResult,
  writeProductZdLookupLastResult,
  type ProductZdLookupStockOutPrefill,
} from "@/lib/orders/product-zd-lookup-session";
import {
  PRODUCT_ZD_LOOKUP_MODAL,
  formatProductZdLookupAppOrderHint,
  productZdLookupAppOrderHint,
  productZdLookupResultSectionHint,
} from "@/lib/orders/product-zd-lookup-ui";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";
import {
  combinedProductSearchDisplay,
  formatSubiektProductOption,
  inferProductZdLookupSearchField,
  minProductSearchLength,
  subiektFieldText,
} from "@/lib/subiekt/product-pick";
import type { SubiektProduct } from "@/lib/subiekt/types";
import { mojeShipmentSectionShellClass } from "@/lib/ui/moje-shipment-row-styles";
import { salesTypography } from "@/lib/ui/ontime-theme";

type LookupPhase = "search" | "loading" | "result";

function IntroStepCard({
  step,
  title,
  detail,
}: {
  step: number;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-indigo-100/90 bg-indigo-50/35 px-3 py-2.5 text-center">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-800">
        {step}
      </span>
      <p className="mt-2 text-xs font-semibold text-slate-900">{title}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-slate-600">{detail}</p>
    </div>
  );
}

function IntroStepsGrid() {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {PRODUCT_ZD_LOOKUP_MODAL.introSteps.map((step, index) => (
        <IntroStepCard
          key={step.title}
          step={index + 1}
          title={step.title}
          detail={step.detail}
        />
      ))}
    </div>
  );
}

function LookupSection({
  icon,
  title,
  hint,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className={cn(mojeShipmentSectionShellClass, "overflow-visible")}>
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-800">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className={salesTypography.blockTitle}>{title}</h3>
          <p className={cn("mt-0.5", salesTypography.sectionHint)}>{hint}</p>
        </div>
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  );
}

function ProductChip({ product }: { product: SubiektProduct }) {
  const symbol = subiektFieldText(product.tw_Symbol) || "—";
  const name = subiektFieldText(product.tw_Nazwa) || symbol;
  const plu = subiektFieldText(product.tw_PLU);
  const stock =
    product.tw_Stan != null && product.tw_StanRez != null
      ? Math.max(0, Number(product.tw_Stan) - Number(product.tw_StanRez))
      : null;

  return (
    <div className="rounded-lg border border-indigo-100/80 bg-indigo-50/25 px-3 py-2.5">
      <p className={cn("truncate font-medium text-slate-900", salesTypography.rowBody)}>{name}</p>
      <p className={cn("mt-0.5 truncate text-slate-600", salesTypography.rowMeta)}>
        {symbol}
        {plu ? ` · Mikran ${plu}` : ""}
        {stock != null ? (
          <>
            {" "}
            · stan <span className="tabular-nums font-medium text-slate-800">{stock}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}

function FoundMatchRow({
  dokNr,
  deadline,
  supplierName,
  quantity,
}: {
  dokNr: string;
  deadline: string;
  supplierName: string | null;
  quantity: number | null;
}) {
  const parsed = parseDateOnly(deadline);
  const display = parsed ? buildDeliveryDateMetaDisplay(parsed) : null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className={cn("font-medium text-slate-900", salesTypography.rowBody)}>
          Termin z dokumentu ZD
        </p>
        <p className={cn("mt-1 text-slate-600", salesTypography.rowMeta)}>
          <span className="font-medium text-slate-800">{dokNr}</span>
          {supplierName ? ` · ${supplierName}` : ""}
          {quantity != null ? (
            <>
              {" "}
              · ilość <span className="tabular-nums font-medium text-slate-800">{quantity}</span>
            </>
          ) : null}
        </p>
      </div>
      {display ? (
        <DeliveryTimingMeta caption={ZD_DELIVERY_META_CAPTION} captionTone="zd" className="shrink-0">
          <DeliveryDateMetaValue display={display} />
          <span className="text-[10px] font-medium text-slate-500">{formatPlDate(deadline)}</span>
        </DeliveryTimingMeta>
      ) : (
        <span className="text-sm font-semibold text-slate-800">{formatPlDate(deadline)}</span>
      )}
    </div>
  );
}

function IncompleteHint({ children }: { children: string }) {
  return (
    <p className="rounded-lg border border-amber-100/90 bg-amber-50/40 px-3 py-2 text-xs leading-relaxed text-amber-900/90">
      {children}
    </p>
  );
}

function resultSectionHint(
  phase: LookupPhase,
  pending: boolean,
  lookupResult: ProductZdLookupResult | null,
  lookupError: string | null
): string {
  return productZdLookupResultSectionHint(
    lookupResult,
    lookupError,
    phase === "loading" || pending
  );
}

export function ProductZdLookupModal({
  open,
  onClose,
  onStockOutPrefill,
  suppliers,
}: {
  open: boolean;
  onClose: () => void;
  onStockOutPrefill?: (prefill: ProductZdLookupStockOutPrefill) => void;
  suppliers: OrderFormSupplierOption[];
}) {
  const listboxId = useId();
  const searchAnchorRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<LookupPhase>("search");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [suggestions, setSuggestions] = useState<SubiektProduct[]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestFeedback, setSuggestFeedback] = useState<
    import("@/lib/subiekt/feedback").SubiektFeedback | null
  >(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SubiektProduct | null>(null);
  const [lookupResult, setLookupResult] = useState<ProductZdLookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [manualSupplierId, setManualSupplierId] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [productTypeaheadOpen, setProductTypeaheadOpen] = useState(true);
  const [pending, startTransition] = useTransition();

  const supplierPickerOptions = useMemo(
    () =>
      suppliers.map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        subiektKhId: supplier.subiekt_kh_id ?? null,
      })),
    [suppliers]
  );

  const reset = useCallback(() => {
    setPhase("search");
    setQuery("");
    setSuggestions([]);
    setSuggestError(null);
    setSuggestFeedback(null);
    setSuggestLoading(false);
    setSelectedProduct(null);
    setLookupResult(null);
    setLookupError(null);
    setManualSupplierId("");
    setHighlightedIndex(0);
    setProductTypeaheadOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const trimmedDebouncedQuery = debouncedQuery.trim();
  const productSearchField = inferProductZdLookupSearchField(trimmedDebouncedQuery);
  const productSearchActive =
    open &&
    phase === "search" &&
    !selectedProduct &&
    trimmedDebouncedQuery.length >= minProductSearchLength(productSearchField);
  const visibleSuggestions = useMemo(
    () => (productSearchActive ? suggestions : []),
    [productSearchActive, suggestions]
  );
  const visibleSuggestError = productSearchActive ? suggestError : null;
  const visibleSuggestFeedback = productSearchActive ? suggestFeedback : null;
  const visibleSuggestLoading = productSearchActive && suggestLoading;
  const [typeaheadQueryKey, setTypeaheadQueryKey] = useState(trimmedDebouncedQuery);
  if (trimmedDebouncedQuery !== typeaheadQueryKey) {
    setTypeaheadQueryKey(trimmedDebouncedQuery);
    setProductTypeaheadOpen(true);
  }
  const typeaheadListVisible = visibleSuggestions.length > 0;
  const typeaheadPanelVisible =
    productSearchActive &&
    productTypeaheadOpen &&
    (visibleSuggestLoading || typeaheadListVisible);

  useEffect(() => {
    if (!typeaheadPanelVisible) return;

    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchAnchorRef.current?.contains(target)) return;
      if (target instanceof Element) {
        const listbox = document.getElementById(listboxId);
        if (listbox?.contains(target)) return;
      }
      setProductTypeaheadOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [listboxId, typeaheadPanelVisible]);

  useEffect(() => {
    if (!productSearchActive) return;

    let cancelled = false;
    void (async () => {
      setSuggestLoading(true);
      setSuggestError(null);
      const result = await actionSubiektSuggestProductsForZdLookup(trimmedDebouncedQuery);
      if (cancelled) return;
      setSuggestLoading(false);
      if (!result.ok) {
        setSuggestions([]);
        setSuggestFeedback(result.feedback ?? null);
        setSuggestError(result.feedback?.message ?? "Nie udało się wyszukać produktu.");
        return;
      }
      setSuggestions(result.items);
      setSuggestFeedback(result.feedback ?? null);
    })();

    return () => {
      cancelled = true;
      setSuggestLoading(false);
    };
  }, [productSearchActive, trimmedDebouncedQuery]);

  const suggestionsKey = visibleSuggestions.map((product) => product.tw_Id).join("\0");
  const [appliedSuggestionsKey, setAppliedSuggestionsKey] = useState(suggestionsKey);
  if (suggestionsKey !== appliedSuggestionsKey) {
    setAppliedSuggestionsKey(suggestionsKey);
    setHighlightedIndex(0);
  }

  const runLookup = useCallback((product: SubiektProduct, supplierId?: string | null) => {
    setPhase("loading");
    setLookupError(null);
    setLookupResult(null);
    startTransition(async () => {
      try {
        const result = await actionLookupProductZdDelivery(product, {
          supplierId: supplierId?.trim() || null,
        });
        setLookupResult(result);
        setPhase("result");
        if (result.status !== "needs_supplier") {
          writeProductZdLookupLastResult(
            buildProductZdLookupLastResult({
              symbol: subiektFieldText(product.tw_Symbol) || "-",
              productName:
                subiektFieldText(product.tw_Nazwa) ||
                subiektFieldText(product.tw_Symbol) ||
                "Produkt",
              subiektTwId: Math.trunc(Number(product.tw_Id)),
              mikranCode: subiektFieldText(product.tw_PLU),
              result,
            })
          );
        }
      } catch (error) {
        setLookupError(
          error instanceof Error ? error.message : "Nie udało się sprawdzić terminu dostawy."
        );
        setPhase("result");
      }
    });
  }, []);

  const pickProduct = useCallback(
    (product: SubiektProduct) => {
      setSelectedProduct(product);
      setManualSupplierId("");
      setQuery(
        combinedProductSearchDisplay({
          symbol: product.tw_Symbol ?? "",
          product: product.tw_Nazwa ?? "",
        })
      );
      setSuggestions([]);
      runLookup(product);
    },
    [runLookup]
  );

  const handleTypeaheadKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (
        event.key === "Escape" &&
        (typeaheadPanelVisible || visibleSuggestLoading)
      ) {
        event.preventDefault();
        event.stopPropagation();
        setProductTypeaheadOpen(false);
        setSuggestions([]);
        setHighlightedIndex(0);
        return;
      }

      if (!typeaheadListVisible) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedIndex((index) => Math.min(index + 1, visibleSuggestions.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        const chosen = visibleSuggestions[highlightedIndex];
        if (chosen) pickProduct(chosen);
        return;
      }
    },
    [
      highlightedIndex,
      pickProduct,
      typeaheadListVisible,
      typeaheadPanelVisible,
      visibleSuggestLoading,
      visibleSuggestions,
    ]
  );

  const appOrderHint = productZdLookupAppOrderHint(lookupResult);

  const stockOutPrefill = useMemo((): ProductZdLookupStockOutPrefill | null => {
    if (!selectedProduct) return null;
    return {
      symbol: subiektFieldText(selectedProduct.tw_Symbol) || "-",
      product:
        subiektFieldText(selectedProduct.tw_Nazwa) ||
        subiektFieldText(selectedProduct.tw_Symbol) ||
        "",
      subiektTwId: Math.trunc(Number(selectedProduct.tw_Id)),
      mikranCode: subiektFieldText(selectedProduct.tw_PLU),
    };
  }, [selectedProduct]);

  const showResultLayout =
    (phase === "loading" || phase === "result") && selectedProduct != null;
  const modalBodyClassName = "px-5 py-5 sm:px-6 sm:py-6";

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title={PRODUCT_ZD_LOOKUP_MODAL.title}
      description={phase === "search" ? PRODUCT_ZD_LOOKUP_MODAL.description : undefined}
      titleHint={PRODUCT_ZD_LOOKUP_MODAL.titleHint}
      size="md"
      tier="raised"
      bodyClassName={modalBodyClassName}
      loadingMessage={pending && phase === "loading" ? "Sprawdzamy ZD w Subiekcie…" : null}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {phase === "result" ? (
            <Button type="button" variant="ghost" onClick={reset}>
              {PRODUCT_ZD_LOOKUP_MODAL.searchAgain}
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={handleClose}>
            {phase === "search" ? PRODUCT_ZD_LOOKUP_MODAL.cancel : PRODUCT_ZD_LOOKUP_MODAL.close}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {phase === "search" ? (
          <>
            <IntroStepsGrid />

            <LookupSection
              icon={<IconPackage size={18} strokeWidth={2} aria-hidden />}
              title={PRODUCT_ZD_LOOKUP_MODAL.searchLabel}
              hint={PRODUCT_ZD_LOOKUP_MODAL.searchHint}
            >
              <Field label="Produkt z Subiekta" labelClassName="sr-only">
                <div
                  ref={searchAnchorRef}
                  className={cn(
                    "relative rounded-md transition-[box-shadow]",
                    typeaheadPanelVisible && "z-30 ring-2 ring-indigo-400/80 ring-offset-2"
                  )}
                >
                  <span
                    className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-slate-400"
                    aria-hidden
                  >
                    <IconSearch size={18} strokeWidth={2} />
                  </span>
                  <Input
                    value={query}
                    role="combobox"
                    onChange={(event) => {
                      setSelectedProduct(null);
                      setQuery(event.target.value);
                      setProductTypeaheadOpen(true);
                    }}
                    onFocus={() => setProductTypeaheadOpen(true)}
                    onKeyDown={handleTypeaheadKeyDown}
                    placeholder={PRODUCT_ZD_LOOKUP_MODAL.searchPlaceholder}
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-expanded={typeaheadPanelVisible}
                    aria-controls={typeaheadPanelVisible ? listboxId : undefined}
                    aria-activedescendant={
                      typeaheadListVisible
                        ? `${listboxId}-opt-${highlightedIndex}`
                        : undefined
                    }
                    className="pl-10"
                    autoFocus
                  />
                  {visibleSuggestLoading ? (
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                      <Spinner size="sm" />
                    </span>
                  ) : null}
                  <TypeaheadDropdown
                    listboxId={listboxId}
                    open={typeaheadPanelVisible}
                    portalled
                    anchorRef={searchAnchorRef}
                    size="comfortable"
                    emptyMessage={visibleSuggestLoading ? "Szukam w Subiekcie…" : undefined}
                    footer={typeaheadListVisible ? TYPEAHEAD_KEYBOARD_HINT : undefined}
                  >
                    <TypeaheadSectionLabel>Subiekt — wybierz produkt</TypeaheadSectionLabel>
                    {typeaheadListVisible
                      ? visibleSuggestions.map((product, index) => {
                          const { title, subtitle } = formatSubiektProductOption(product);
                          return (
                            <TypeaheadOption
                              key={product.tw_Id}
                              optionId={`${listboxId}-opt-${index}`}
                              onSelect={() => pickProduct(product)}
                              onHighlight={() => setHighlightedIndex(index)}
                              highlighted={highlightedIndex === index}
                              title={title}
                              subtitle={subtitle}
                              size="comfortable"
                            />
                          );
                        })
                      : null}
                  </TypeaheadDropdown>
                </div>
              </Field>
              {visibleSuggestFeedback ? (
                <SubiektFeedbackAlert feedback={visibleSuggestFeedback} />
              ) : null}
              {visibleSuggestError && !visibleSuggestFeedback ? (
                <Alert tone="warning">{visibleSuggestError}</Alert>
              ) : null}
            </LookupSection>
          </>
        ) : null}

        {showResultLayout ? (
          <LookupSection
            icon={<IconCalendar size={18} strokeWidth={2} aria-hidden />}
            title={PRODUCT_ZD_LOOKUP_MODAL.resultLabel}
            hint={resultSectionHint(phase, pending, lookupResult, lookupError)}
          >
              <ProductChip product={selectedProduct} />

              {phase === "loading" ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Spinner size="sm" />
                  <p className={salesTypography.rowMeta}>Łączymy towar z dokumentami ZD…</p>
                </div>
              ) : null}

              {lookupError ? <Alert tone="error">{lookupError}</Alert> : null}

              {lookupResult?.status === "offline" ? (
                <Alert tone="warning">
                  <p>{lookupResult.message}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      if (!selectedProduct) return;
                      const supplierId = manualSupplierId || null;
                      runLookup(selectedProduct, supplierId);
                    }}
                  >
                    {PRODUCT_ZD_LOOKUP_MODAL.retry}
                  </Button>
                </Alert>
              ) : null}

              {lookupResult?.status === "invalid_product" ? (
                <Alert tone="warning">{lookupResult.message}</Alert>
              ) : null}

              {lookupResult?.status === "needs_supplier" ? (
                <div className="space-y-3">
                  <Alert tone="info">{lookupResult.message}</Alert>
                  <Field label="Dostawca" labelClassName="text-sm font-medium text-slate-800">
                    <SupplierPickerField
                      suppliers={supplierPickerOptions}
                      value={manualSupplierId}
                      onChange={setManualSupplierId}
                      allowEmpty={false}
                      placeholder="Wybierz dostawcę…"
                      dropdownSize="comfortable"
                    />
                  </Field>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!manualSupplierId || pending}
                    onClick={() => selectedProduct && runLookup(selectedProduct, manualSupplierId)}
                  >
                    {PRODUCT_ZD_LOOKUP_MODAL.searchWithSupplier}
                  </Button>
                </div>
              ) : null}

              {lookupResult?.status === "supplier_unmapped" ? (
                <Alert tone="warning">{lookupResult.message}</Alert>
              ) : null}

              {lookupResult?.status === "found" ? (
                <div className="space-y-2">
                  {lookupResult.matches.map((match) => (
                    <FoundMatchRow
                      key={`${match.dokId}|${match.deadline}`}
                      dokNr={match.dokNr}
                      deadline={match.deadline}
                      supplierName={match.supplierName}
                      quantity={match.quantity}
                    />
                  ))}
                  {lookupResult.searchIncomplete ? (
                    <IncompleteHint>
                      Przeszukaliśmy ograniczoną liczbę dokumentów — w Subiekcie mogą być jeszcze
                      inne ZD.
                    </IncompleteHint>
                  ) : null}
                </div>
              ) : null}

              {lookupResult?.status === "no_match" ? (
                <div className="space-y-3">
                  {appOrderHint ? (
                    <p className={cn("text-sm text-slate-800", salesTypography.rowBody)}>
                      <span className="font-medium">{PRODUCT_ZD_LOOKUP_MODAL.appOrderHintTitle}:</span>{" "}
                      {formatProductZdLookupAppOrderHint(appOrderHint)}
                    </p>
                  ) : null}
                  {lookupResult.searchIncomplete ? (
                    <p className={cn(salesTypography.rowMeta, "text-slate-600")}>
                      Wynik może być niepełny — przeszukano limit dokumentów w Subiekcie.
                    </p>
                  ) : (
                    <p className={cn(salesTypography.rowMeta, "text-slate-500")}>
                      {PRODUCT_ZD_LOOKUP_MODAL.noZdWarehouseNote}
                    </p>
                  )}
                  {onStockOutPrefill && stockOutPrefill ? (
                    <Button
                      type="button"
                      size="sm"
                      className="w-full sm:w-auto"
                      title={PRODUCT_ZD_LOOKUP_MODAL.stockOutHint}
                      onClick={() => {
                        onStockOutPrefill(stockOutPrefill);
                        handleClose();
                      }}
                    >
                      {PRODUCT_ZD_LOOKUP_MODAL.stockOutCta}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </LookupSection>
        ) : null}
      </div>
    </ModalShell>
  );
}
