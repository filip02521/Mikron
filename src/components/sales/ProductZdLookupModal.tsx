"use client";

import { useCallback, useEffect, useId, useMemo, useState, useTransition } from "react";
import { actionSubiektSuggestProducts } from "@/app/actions/subiekt";
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
} from "@/components/ui/TypeaheadDropdown";
import {
  IconCalendar,
  IconCircleCheck,
  IconPackage,
  IconSearch,
  IconTruck,
} from "@/components/icons/StrokeIcons";
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
  productZdLookupStepClass,
  productZdLookupSupplierName,
  type ProductZdLookupStepState,
} from "@/lib/orders/product-zd-lookup-ui";
import {
  combinedProductSearchDisplay,
  formatSubiektProductOption,
  inferCombinedProductSearchField,
  minProductSearchLength,
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

function LookupStep({
  label,
  state,
}: {
  label: string;
  state: ProductZdLookupStepState;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        productZdLookupStepClass(state)
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
          state === "done"
            ? "border-emerald-300 bg-white text-emerald-700"
            : state === "active"
              ? "border-indigo-300 bg-white text-indigo-700"
              : "border-slate-200 bg-white text-slate-400"
        )}
        aria-hidden
      >
        {state === "done" ? (
          <IconCircleCheck size={16} strokeWidth={2.2} />
        ) : state === "active" ? (
          <Spinner size="sm" />
        ) : (
          "·"
        )}
      </span>
      <span className="min-w-0 text-sm leading-snug">{label}</span>
    </li>
  );
}

function ProductSummaryCard({ product }: { product: SubiektProduct }) {
  const symbol = product.tw_Symbol?.trim() || "—";
  const name = product.tw_Nazwa?.trim() || symbol;
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const stock =
    product.tw_Stan != null && product.tw_StanRez != null
      ? Math.max(0, Number(product.tw_Stan) - Number(product.tw_StanRez))
      : null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white px-4 py-3.5">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-sm font-bold text-indigo-800"
        aria-hidden
      >
        {initials || "?"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
        <p className={cn("mt-1 text-xs text-slate-600", salesTypography.rowMeta)}>
          Symbol <span className="font-medium text-slate-800">{symbol}</span>
          {product.tw_PLU?.trim() ? (
            <>
              {" "}
              · Mikran <span className="font-medium text-slate-800">{product.tw_PLU.trim()}</span>
            </>
          ) : null}
        </p>
        {stock != null ? (
          <p className="mt-1.5 text-xs text-slate-600">
            Stan magazynowy:{" "}
            <span className="font-semibold tabular-nums text-slate-900">{stock}</span>
          </p>
        ) : null}
      </div>
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
    <div className="overflow-hidden rounded-xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/90 to-white shadow-sm shadow-emerald-900/5">
      <div className="border-b border-emerald-100/90 bg-emerald-100/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <IconCircleCheck size={18} className="shrink-0 text-emerald-700" aria-hidden />
          <p className="text-sm font-semibold text-emerald-950">Towar zamówiony u dostawcy</p>
        </div>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-3.5">
        <div className="min-w-0 space-y-1.5">
          {supplierName ? (
            <p className="text-xs text-emerald-900/85">
              Dostawca: <span className="font-semibold text-emerald-950">{supplierName}</span>
            </p>
          ) : null}
          <p className="text-xs text-emerald-900/80">
            Dokument ZD: <span className="font-semibold text-emerald-950">{dokNr}</span>
            {quantity != null ? (
              <>
                {" "}
                · ilość <span className="font-semibold tabular-nums">{quantity}</span>
              </>
            ) : null}
          </p>
        </div>
        {display ? (
          <DeliveryTimingMeta caption={ZD_DELIVERY_META_CAPTION} captionTone="zd">
            <DeliveryDateMetaValue display={display} />
            <span className="text-[10px] font-medium text-slate-500">{formatPlDate(deadline)}</span>
          </DeliveryTimingMeta>
        ) : (
          <span className="text-sm font-semibold text-slate-800">{formatPlDate(deadline)}</span>
        )}
      </div>
    </div>
  );
}

export function ProductZdLookupModal({
  open,
  onClose,
  onStockOutPrefill,
}: {
  open: boolean;
  onClose: () => void;
  onStockOutPrefill?: (prefill: ProductZdLookupStockOutPrefill) => void;
}) {
  const listboxId = useId();
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
  const [pending, startTransition] = useTransition();

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
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const trimmedDebouncedQuery = debouncedQuery.trim();
  const productSearchField = inferCombinedProductSearchField(trimmedDebouncedQuery);
  const productSearchActive =
    open &&
    phase === "search" &&
    !selectedProduct &&
    trimmedDebouncedQuery.length >= minProductSearchLength(productSearchField);
  const visibleSuggestions = productSearchActive ? suggestions : [];
  const visibleSuggestError = productSearchActive ? suggestError : null;
  const visibleSuggestFeedback = productSearchActive ? suggestFeedback : null;
  const visibleSuggestLoading = productSearchActive && suggestLoading;

  useEffect(() => {
    if (!productSearchActive) return;

    let cancelled = false;
    void (async () => {
      setSuggestLoading(true);
      setSuggestError(null);
      const field = inferCombinedProductSearchField(trimmedDebouncedQuery);
      const result = await actionSubiektSuggestProducts(trimmedDebouncedQuery, field);
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

  const runLookup = useCallback((product: SubiektProduct) => {
    setPhase("loading");
    setLookupError(null);
    setLookupResult(null);
    startTransition(async () => {
      try {
        const result = await actionLookupProductZdDelivery(product);
        setLookupResult(result);
        setPhase("result");
        writeProductZdLookupLastResult(
          buildProductZdLookupLastResult({
            symbol: product.tw_Symbol?.trim() || "-",
            productName: product.tw_Nazwa?.trim() || product.tw_Symbol?.trim() || "Produkt",
            subiektTwId: Math.trunc(Number(product.tw_Id)),
            mikranCode: product.tw_PLU,
            result,
          })
        );
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

  const supplierStepState: ProductZdLookupStepState = useMemo(() => {
    if (phase === "search") return "pending";
    if (phase === "loading") return "active";
    if (lookupResult?.status === "no_match" && !productZdLookupSupplierName(lookupResult)) {
      return "skipped";
    }
    return "done";
  }, [lookupResult, phase]);

  const resolvedSupplierName = productZdLookupSupplierName(lookupResult);

  const stockOutPrefill = useMemo((): ProductZdLookupStockOutPrefill | null => {
    if (!selectedProduct) return null;
    return {
      symbol: selectedProduct.tw_Symbol?.trim() || "-",
      product: selectedProduct.tw_Nazwa?.trim() || selectedProduct.tw_Symbol?.trim() || "",
      subiektTwId: Math.trunc(Number(selectedProduct.tw_Id)),
      mikranCode: selectedProduct.tw_PLU?.trim() ?? "",
    };
  }, [selectedProduct]);

  const typeaheadOpen = visibleSuggestions.length > 0 && !selectedProduct && phase === "search";

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title={PRODUCT_ZD_LOOKUP_MODAL.title}
      description={PRODUCT_ZD_LOOKUP_MODAL.description}
      titleHint={PRODUCT_ZD_LOOKUP_MODAL.titleHint}
      size="md"
      tier="raised"
      bodyClassName="px-5 py-5 sm:px-6 sm:py-6"
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

            <section className={mojeShipmentSectionShellClass}>
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-800">
                  <IconPackage size={18} strokeWidth={2} aria-hidden />
                </span>
                <div>
                  <h3 className={salesTypography.blockTitle}>{PRODUCT_ZD_LOOKUP_MODAL.searchLabel}</h3>
                  <p className={cn("mt-0.5", salesTypography.sectionHint)}>
                    {PRODUCT_ZD_LOOKUP_MODAL.searchHint}
                  </p>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <Field label="Produkt z Subiekta" labelClassName="sr-only">
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-slate-400"
                      aria-hidden
                    >
                      {visibleSuggestLoading ? <Spinner size="sm" /> : <IconSearch size={18} strokeWidth={2} />}
                    </span>
                    <Input
                      value={query}
                      onChange={(event) => {
                        setSelectedProduct(null);
                        setQuery(event.target.value);
                      }}
                      placeholder={PRODUCT_ZD_LOOKUP_MODAL.searchPlaceholder}
                      autoComplete="off"
                      aria-controls={listboxId}
                      className="pl-10"
                      autoFocus
                    />
                    <TypeaheadDropdown
                      listboxId={listboxId}
                      open={typeaheadOpen}
                      size="comfortable"
                      className="left-0 right-0"
                      emptyMessage={suggestLoading ? "Szukam w Subiekcie…" : undefined}
                    >
                      <TypeaheadSectionLabel>Subiekt — wybierz produkt</TypeaheadSectionLabel>
                      {visibleSuggestions.map((product) => {
                        const { title, subtitle } = formatSubiektProductOption(product);
                        return (
                          <TypeaheadOption
                            key={product.tw_Id}
                            onSelect={() => pickProduct(product)}
                            title={title}
                            subtitle={subtitle}
                            size="comfortable"
                          />
                        );
                      })}
                    </TypeaheadDropdown>
                  </div>
                </Field>
                {visibleSuggestFeedback ? <SubiektFeedbackAlert feedback={visibleSuggestFeedback} /> : null}
                {visibleSuggestError && !visibleSuggestFeedback ? (
                  <Alert tone="warning">{visibleSuggestError}</Alert>
                ) : null}
              </div>
            </section>
          </>
        ) : null}

        {selectedProduct ? <ProductSummaryCard product={selectedProduct} /> : null}

        {phase !== "search" ? (
          <section className={mojeShipmentSectionShellClass}>
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-800">
                <IconTruck size={18} strokeWidth={2} aria-hidden />
              </span>
              <div>
                <h3 className={salesTypography.blockTitle}>{PRODUCT_ZD_LOOKUP_MODAL.lookupTitle}</h3>
                <p className={cn("mt-0.5", salesTypography.sectionHint)}>
                  Łączymy towar z otwartymi dokumentami ZD w Subiekcie.
                </p>
              </div>
            </div>
            <ol className="space-y-2 p-4">
              <LookupStep label={PRODUCT_ZD_LOOKUP_MODAL.lookupSteps.product} state="done" />
              <LookupStep
                label={
                  resolvedSupplierName
                    ? `${PRODUCT_ZD_LOOKUP_MODAL.lookupSteps.supplier}: ${resolvedSupplierName}`
                    : PRODUCT_ZD_LOOKUP_MODAL.lookupSteps.supplier
                }
                state={supplierStepState}
              />
              <LookupStep
                label={PRODUCT_ZD_LOOKUP_MODAL.lookupSteps.zd}
                state={phase === "loading" ? "active" : phase === "result" ? "done" : "pending"}
              />
            </ol>
          </section>
        ) : null}

        {lookupError ? <Alert tone="error">{lookupError}</Alert> : null}

        {lookupResult?.status === "offline" ? (
          <Alert tone="warning">
            <p>{lookupResult.message}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => selectedProduct && runLookup(selectedProduct)}
            >
              {PRODUCT_ZD_LOOKUP_MODAL.retry}
            </Button>
          </Alert>
        ) : null}

        {lookupResult?.status === "invalid_product" ? (
          <Alert tone="warning">{lookupResult.message}</Alert>
        ) : null}

        {lookupResult?.status === "found" ? (
          <div className="space-y-3">
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
              <p className="rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
                Przeszukaliśmy ograniczoną liczbę dokumentów — w Subiekcie mogą być jeszcze inne
                ZD.
              </p>
            ) : null}
          </div>
        ) : null}

        {lookupResult?.status === "no_match" ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50/90 to-white shadow-sm shadow-amber-900/5">
              <div className="border-b border-amber-100/90 bg-amber-100/50 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <IconCalendar size={18} className="shrink-0 text-amber-800" aria-hidden />
                  <p className="text-sm font-semibold text-amber-950">Nie znaleźliśmy otwartego ZD</p>
                </div>
              </div>
              <div className="space-y-2 px-4 py-3.5">
                <p className="text-sm leading-relaxed text-amber-950/90">
                  {lookupResult.supplierName
                    ? `Sprawdziliśmy dokumenty ZD u dostawcy ${lookupResult.supplierName}.`
                    : "Sprawdziliśmy dokumenty ZD w Subiekcie dla tego towaru."}{" "}
                  Towar może nie być jeszcze zamówiony u dostawcy.
                </p>
                <p className="text-xs text-amber-900/75">
                  Brak terminu w ZD nie oznacza automatycznie dostępności na magazynie — to osobna
                  informacja.
                </p>
              </div>
            </div>
            {lookupResult.searchIncomplete ? (
              <p className="rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
                Wynik może być niepełny — Subiekt zwrócił limit dokumentów do przeszukania.
              </p>
            ) : null}
            {onStockOutPrefill && stockOutPrefill ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">
                  {PRODUCT_ZD_LOOKUP_MODAL.stockOutCta}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {PRODUCT_ZD_LOOKUP_MODAL.stockOutHint}
                </p>
                <Button
                  type="button"
                  className="mt-3 w-full sm:w-auto"
                  onClick={() => {
                    onStockOutPrefill(stockOutPrefill);
                    handleClose();
                  }}
                >
                  {PRODUCT_ZD_LOOKUP_MODAL.stockOutCta}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
}
