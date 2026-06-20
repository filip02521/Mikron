"use client";

import { useCallback, useEffect, useId, useMemo, useState, useTransition } from "react";
import { actionSubiektSuggestProducts } from "@/app/actions/subiekt";
import { actionLookupProductZdDelivery } from "@/app/actions/product-zd-lookup";
import type { ProductZdLookupResult } from "@/app/actions/product-zd-lookup";
import { DeliveryDateMetaValue } from "@/components/orders/DeliveryDateMetaValue";
import { DeliveryTimingMeta } from "@/components/orders/DeliveryTimingMeta";
import { ZdEtaNoMatchMeta } from "@/components/orders/ZdEtaNoMatchMeta";
import { SubiektFeedbackAlert } from "@/components/subiekt/SubiektFeedbackAlert";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { Alert } from "@/components/ui/Alert";
import {
  TypeaheadDropdown,
  TypeaheadOption,
} from "@/components/ui/TypeaheadDropdown";
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
  type ProductZdLookupStepState,
} from "@/lib/orders/product-zd-lookup-ui";
import {
  combinedProductSearchDisplay,
  formatSubiektProductOption,
  inferCombinedProductSearchField,
  minProductSearchLength,
} from "@/lib/subiekt/product-pick";
import type { SubiektProduct } from "@/lib/subiekt/types";
import { brandLinkClass, salesTypography } from "@/lib/ui/ontime-theme";

type LookupPhase = "search" | "loading" | "result";

function LookupStep({
  label,
  state,
}: {
  label: string;
  state: ProductZdLookupStepState;
}) {
  const marker =
    state === "done" ? "✓" : state === "active" ? "…" : state === "skipped" ? "—" : "○";
  return (
    <li className={cn("flex items-start gap-2 text-sm", productZdLookupStepClass(state))}>
      <span aria-hidden className="mt-0.5 w-4 shrink-0 text-center font-semibold">
        {marker}
      </span>
      <span>{label}</span>
    </li>
  );
}

function ProductSummaryCard({ product }: { product: SubiektProduct }) {
  const symbol = product.tw_Symbol?.trim() || "—";
  const name = product.tw_Nazwa?.trim() || symbol;
  const stock =
    product.tw_Stan != null && product.tw_StanRez != null
      ? Math.max(0, Number(product.tw_Stan) - Number(product.tw_StanRez))
      : null;

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5">
      <p className="text-sm font-semibold text-slate-900">{name}</p>
      <p className={cn("mt-0.5 text-xs text-slate-600", salesTypography.rowMeta)}>
        Symbol: <span className="font-medium text-slate-800">{symbol}</span>
        {product.tw_PLU?.trim() ? (
          <>
            {" "}
            · Mikran: <span className="font-medium text-slate-800">{product.tw_PLU.trim()}</span>
          </>
        ) : null}
      </p>
      {stock != null ? (
        <p className="mt-1 text-xs text-slate-600">
          Stan magazynowy:{" "}
          <span className="font-semibold tabular-nums text-slate-900">{stock}</span>
        </p>
      ) : null}
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
    <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-emerald-950">Towar zamówiony u dostawcy</p>
          <p className="text-xs text-emerald-900/85">
            {supplierName ? (
              <>
                Dostawca: <span className="font-medium">{supplierName}</span>
              </>
            ) : (
              "Dopasowany dokument ZD w Subiekcie"
            )}
          </p>
          <p className="text-xs text-emerald-900/80">
            Dokument: <span className="font-medium">{dokNr}</span>
            {quantity != null ? (
              <>
                {" "}
                · ilość: <span className="font-medium tabular-nums">{quantity}</span>
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
    setSelectedProduct(null);
    setLookupResult(null);
    setLookupError(null);
  }, []);

  useEffect(() => {
    if (open) return;
    reset();
  }, [open, reset]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!open || phase !== "search" || selectedProduct) return;
    if (q.length < minProductSearchLength(inferCombinedProductSearchField(q))) {
      setSuggestions([]);
      setSuggestError(null);
      setSuggestFeedback(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      setSuggestLoading(true);
      setSuggestError(null);
      const field = inferCombinedProductSearchField(q);
      const result = await actionSubiektSuggestProducts(q, field);
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
    };
  }, [debouncedQuery, open, phase, selectedProduct]);

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
    if (lookupResult?.status === "no_match" && !lookupResult.supplierName) return "skipped";
    return "done";
  }, [lookupResult, phase]);

  const stockOutPrefill = useMemo((): ProductZdLookupStockOutPrefill | null => {
    if (!selectedProduct) return null;
    return {
      symbol: selectedProduct.tw_Symbol?.trim() || "-",
      product: selectedProduct.tw_Nazwa?.trim() || selectedProduct.tw_Symbol?.trim() || "",
      subiektTwId: Math.trunc(Number(selectedProduct.tw_Id)),
      mikranCode: selectedProduct.tw_PLU?.trim() ?? "",
    };
  }, [selectedProduct]);

  const footer =
    phase === "result" ? (
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={reset}>
          {PRODUCT_ZD_LOOKUP_MODAL.searchAgain}
        </Button>
        <Button type="button" onClick={onClose}>
          {PRODUCT_ZD_LOOKUP_MODAL.close}
        </Button>
      </div>
    ) : undefined;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={PRODUCT_ZD_LOOKUP_MODAL.title}
      titleHint={PRODUCT_ZD_LOOKUP_MODAL.titleHint}
      size="sm"
      footer={footer}
      loadingMessage={pending && phase === "loading" ? "Sprawdzamy ZD w Subiekcie…" : null}
    >
      <div className="space-y-4">
        {phase === "search" ? (
          <Field label={PRODUCT_ZD_LOOKUP_MODAL.searchLabel} hint={PRODUCT_ZD_LOOKUP_MODAL.searchHint}>
            <div className="relative">
              <Input
                value={query}
                onChange={(event) => {
                  setSelectedProduct(null);
                  setQuery(event.target.value);
                }}
                placeholder={PRODUCT_ZD_LOOKUP_MODAL.searchPlaceholder}
                autoComplete="off"
                aria-controls={listboxId}
              />
              <TypeaheadDropdown
                listboxId={listboxId}
                open={suggestions.length > 0 && !selectedProduct}
              >
                {suggestions.map((product) => {
                  const { title, subtitle } = formatSubiektProductOption(product);
                  return (
                    <TypeaheadOption
                      key={product.tw_Id}
                      onSelect={() => pickProduct(product)}
                      title={title}
                      subtitle={subtitle}
                    />
                  );
                })}
              </TypeaheadDropdown>
            </div>
            {suggestLoading ? (
              <p className="text-xs text-slate-500">Szukamy w Subiekcie…</p>
            ) : null}
            {suggestFeedback ? <SubiektFeedbackAlert feedback={suggestFeedback} /> : null}
            {suggestError && !suggestFeedback ? (
              <Alert tone="warning">{suggestError}</Alert>
            ) : null}
          </Field>
        ) : null}

        {selectedProduct ? <ProductSummaryCard product={selectedProduct} /> : null}

        {phase !== "search" ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {PRODUCT_ZD_LOOKUP_MODAL.lookupTitle}
            </p>
            <ol className="mt-2 space-y-1.5">
              <LookupStep label={PRODUCT_ZD_LOOKUP_MODAL.lookupSteps.product} state="done" />
              <LookupStep
                label={
                  lookupResult?.supplierName
                    ? `${PRODUCT_ZD_LOOKUP_MODAL.lookupSteps.supplier}: ${lookupResult.supplierName}`
                    : PRODUCT_ZD_LOOKUP_MODAL.lookupSteps.supplier
                }
                state={supplierStepState}
              />
              <LookupStep
                label={PRODUCT_ZD_LOOKUP_MODAL.lookupSteps.zd}
                state={phase === "loading" ? "active" : phase === "result" ? "done" : "pending"}
              />
            </ol>
          </div>
        ) : null}

        {lookupError ? <Alert tone="error">{lookupError}</Alert> : null}

        {lookupResult?.status === "offline" ? (
          <Alert tone="warning">{lookupResult.message}</Alert>
        ) : null}

        {lookupResult?.status === "invalid_product" ? (
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
              <p className="text-xs text-amber-800">
                Przeszukaliśmy ograniczoną liczbę dokumentów — w Subiekcie mogą być jeszcze inne
                ZD.
              </p>
            ) : null}
          </div>
        ) : null}

        {lookupResult?.status === "no_match" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-amber-200/90 bg-amber-50/80 px-3 py-3">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-amber-950">Nie znaleźliśmy otwartego ZD</p>
                <p className="text-xs leading-relaxed text-amber-900/90">
                  {lookupResult.supplierName
                    ? `Sprawdziliśmy dokumenty ZD u dostawcy ${lookupResult.supplierName}.`
                    : "Sprawdziliśmy dokumenty ZD w Subiekcie dla tego towaru."}{" "}
                  Towar może nie być jeszcze zamówiony u dostawcy.
                </p>
              </div>
              <ZdEtaNoMatchMeta className="items-start text-left" />
            </div>
            {lookupResult.searchIncomplete ? (
              <p className="text-xs text-amber-800">
                Wynik może być niepełny — Subiekt zwrócił limit dokumentów do przeszukania.
              </p>
            ) : null}
            {onStockOutPrefill && stockOutPrefill ? (
              <div className="space-y-2 rounded-lg border border-amber-200/70 bg-white px-3 py-3">
                <p className="text-sm font-medium text-slate-900">
                  {PRODUCT_ZD_LOOKUP_MODAL.stockOutCta}
                </p>
                <p className="text-xs text-slate-600">{PRODUCT_ZD_LOOKUP_MODAL.stockOutHint}</p>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    onStockOutPrefill(stockOutPrefill);
                    onClose();
                  }}
                >
                  {PRODUCT_ZD_LOOKUP_MODAL.stockOutCta}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {lookupResult?.status === "offline" ? (
          <button type="button" className={brandLinkClass} onClick={() => selectedProduct && runLookup(selectedProduct)}>
            {PRODUCT_ZD_LOOKUP_MODAL.retry}
          </button>
        ) : null}
      </div>
    </ModalShell>
  );
}
