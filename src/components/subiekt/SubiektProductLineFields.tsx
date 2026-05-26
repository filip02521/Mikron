"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { actionSubiektSuggestProducts } from "@/app/actions/subiekt";
import type { IndividualRequestKind } from "@/types/database";
import { Field, Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { SubiektFeedbackAlert } from "@/components/subiekt/SubiektFeedbackAlert";
import {
  TypeaheadDropdown,
  TypeaheadOption,
  TypeaheadSectionLabel,
} from "@/components/ui/TypeaheadDropdown";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { getSubiektFeedback } from "@/lib/subiekt/feedback";
import {
  buildProductPickFromSubiekt,
  formatSubiektProductOption,
} from "@/lib/subiekt/product-pick";
import { cn } from "@/lib/cn";
import {
  MAX_PRODUCT_TEXT_LEN,
  MAX_QUANTITY_LEN,
  MAX_SYMBOL_LEN,
} from "@/lib/security/text-limits";
import type { AppSupplierRef } from "@/lib/subiekt/match-supplier";
import type { SubiektProduct } from "@/lib/subiekt/types";

export type SubiektProductLineValue = {
  symbol: string;
  product: string;
  quantity: string;
  subiektTwId?: number | null;
};

type ActiveField = "symbol" | "product";

export function SubiektProductLineFields({
  value,
  onChange,
  requestKind,
  disabled,
  appearance = "default",
  productFieldClassName,
  suppliers,
  onSupplierResolved,
  onSupplierResolveFeedback,
  delegateAlerts = false,
  onProductFeedbackChange,
  onConfigFeedbackChange,
  onResolvingSupplierChange,
}: {
  value: SubiektProductLineValue;
  onChange: (patch: Partial<SubiektProductLineValue>) => void;
  requestKind: IndividualRequestKind;
  disabled?: boolean;
  appearance?: "default" | "prosba";
  productFieldClassName?: string;
  /** Lista dostawców aplikacji — do auto-uzupełnienia po wyborze towaru z Subiekta. */
  suppliers?: AppSupplierRef[];
  onSupplierResolved?: (result: {
    supplierId: string;
    supplierName: string;
    documentNumber: string | null;
  }) => void;
  onSupplierResolveFeedback?: (feedback: SubiektFeedback | null) => void;
  /** Komunikaty w RequestFormStatusPanel zamiast pod polami */
  delegateAlerts?: boolean;
  onProductFeedbackChange?: (feedback: SubiektFeedback | null) => void;
  onConfigFeedbackChange?: (feedback: SubiektFeedback | null) => void;
  onResolvingSupplierChange?: (resolving: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [configFeedback, setConfigFeedback] = useState<SubiektFeedback | null>(null);
  const [activeField, setActiveField] = useState<ActiveField>("symbol");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SubiektProduct[]>([]);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [feedback, setFeedback] = useState<SubiektFeedback | null>(null);
  const [supplierFeedback, setSupplierFeedback] = useState<SubiektFeedback | null>(
    null
  );
  const [resolvingSupplier, setResolvingSupplier] = useState(false);
  const [, startTransition] = useTransition();

  const querySource = activeField === "symbol" ? value.symbol : value.product;
  const debounced = useDebouncedValue(querySource.trim(), 320);
  const prosba = appearance === "prosba";
  const isInformacja = requestKind === "informacja";

  useEffect(() => {
    void (async () => {
      const { actionSubiektSuggestionsEnabled } = await import("@/app/actions/subiekt");
      const r = await actionSubiektSuggestionsEnabled();
      setEnabled(r.enabled);
      setConfigFeedback(r.feedback ?? null);
    })();
  }, []);

  useEffect(() => {
    if (!delegateAlerts) return;
    onConfigFeedbackChange?.(configFeedback);
  }, [configFeedback, delegateAlerts, onConfigFeedbackChange]);

  useEffect(() => {
    if (!delegateAlerts) return;
    const productFb =
      feedback && (feedback.tone !== "info" || items.length === 0) ? feedback : null;
    onProductFeedbackChange?.(productFb);
  }, [feedback, items.length, delegateAlerts, onProductFeedbackChange]);

  useEffect(() => {
    onResolvingSupplierChange?.(resolvingSupplier);
  }, [resolvingSupplier, onResolvingSupplierChange]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setFeedback(null);
      return;
    }
    if (debounced.length < 2) {
      setItems([]);
      setFeedback(debounced.length === 1 ? getSubiektFeedback("short_query") : null);
      return;
    }

    setStatus("loading");
    setFeedback(null);
    startTransition(async () => {
      const res = await actionSubiektSuggestProducts(debounced);
      if (!res.ok) {
        setItems([]);
        setFeedback(res.feedback);
        setOpen(false);
        return;
      }
      setItems(res.items);
      setFeedback(res.feedback ?? null);
      setOpen(res.items.length > 0);
    });
  }, [debounced, enabled]);

  const pick = (p: SubiektProduct) => {
    const patch = buildProductPickFromSubiekt(p, requestKind, value.quantity);
    onChange({ ...patch, subiektTwId: patch.subiektTwId });
    setFeedback(null);
    setOpen(false);

    if (!suppliers?.length || !onSupplierResolved) return;

    setResolvingSupplier(true);
    setSupplierFeedback(null);
    onSupplierResolveFeedback?.(null);
    startTransition(async () => {
      try {
        const { actionSubiektResolveSupplierForProduct } = await import(
          "@/app/actions/subiekt"
        );
        const res = await actionSubiektResolveSupplierForProduct(p, suppliers);
        if (res.ok) {
          onSupplierResolved({
            supplierId: res.supplierId,
            supplierName: res.supplierName,
            documentNumber: res.documentNumber,
          });
          setSupplierFeedback(null);
          onSupplierResolveFeedback?.(null);
        } else {
          if (!delegateAlerts) setSupplierFeedback(res.feedback);
          onSupplierResolveFeedback?.(res.feedback);
        }
      } finally {
        setResolvingSupplier(false);
      }
    });
  };

  const manualPatch = (
    patch: Partial<SubiektProductLineValue>,
    clearSubiekt = false
  ) => {
    onChange(clearSubiekt ? { ...patch, subiektTwId: null } : patch);
  };

  const showError = feedback && feedback.tone !== "info";
  const showInfo = feedback && feedback.tone === "info" && items.length === 0;
  const subiektPlaceholder = enabled
    ? "Szukaj w Subiekcie (symbol lub nazwa)…"
    : "Wpisz ręcznie";

  return (
    <div ref={ref} className="relative space-y-2">
      <div
        className={cn(
          "grid gap-3",
          prosba ? "grid-cols-1" : isInformacja ? "sm:grid-cols-3" : "sm:grid-cols-4"
        )}
      >
        <Field label="Symbol">
          <div className="relative">
            <Input
              disabled={disabled}
              placeholder={enabled ? "np. ABC" : "np. ABC"}
              maxLength={MAX_SYMBOL_LEN}
              value={value.symbol}
              autoComplete="off"
              onChange={(e) => {
                manualPatch({ symbol: e.target.value }, true);
                setActiveField("symbol");
                setOpen(true);
              }}
              onFocus={() => {
                setActiveField("symbol");
                setOpen(true);
              }}
            />
            {activeField === "symbol" && status === "loading" ? (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <Spinner size="sm" />
              </span>
            ) : null}
          </div>
        </Field>

        <Field
          label={
            isInformacja ? "Produkt (co ma być na stanie)" : "Produkty"
          }
          className={productFieldClassName}
        >
          <div className="relative">
            <Input
              disabled={disabled}
              placeholder={
                isInformacja
                  ? subiektPlaceholder
                  : enabled
                    ? "Nazwa z Subiekta lub opis…"
                    : "Opis produktów"
              }
              maxLength={MAX_PRODUCT_TEXT_LEN}
              value={value.product}
              autoComplete="off"
              onChange={(e) => {
                manualPatch({ product: e.target.value }, true);
                setActiveField("product");
                setOpen(true);
              }}
              onFocus={() => {
                setActiveField("product");
                setOpen(true);
              }}
            />
            {activeField === "product" && status === "loading" ? (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <Spinner size="sm" />
              </span>
            ) : null}
          </div>
        </Field>

        {!isInformacja ? (
          <Field label="Ilość (wymagane)">
            <Input
              type="number"
              min={1}
              step={1}
              required
              disabled={disabled}
              maxLength={MAX_QUANTITY_LEN}
              placeholder="np. 1"
              value={value.quantity}
              onChange={(e) => onChange({ quantity: e.target.value })}
            />
          </Field>
        ) : null}
      </div>

      {!enabled && configFeedback && !delegateAlerts ? (
        <SubiektFeedbackAlert feedback={configFeedback} compact />
      ) : null}

      {enabled ? (
        <>
          <TypeaheadDropdown
            open={open && items.length > 0}
            className="left-0 right-0 z-20"
            emptyMessage={status === "loading" ? "Szukam w Subiekcie…" : undefined}
          >
            <TypeaheadSectionLabel>
              Subiekt — {activeField === "product" ? "po nazwie" : "po symbolu"}
            </TypeaheadSectionLabel>
            {items.map((p) => {
              const { title, subtitle } = formatSubiektProductOption(p);
              return (
                <TypeaheadOption
                  key={p.tw_Id}
                  title={title}
                  subtitle={subtitle}
                  badge="towar"
                  onSelect={() => pick(p)}
                />
              );
            })}
          </TypeaheadDropdown>

          {!delegateAlerts && !feedback && !resolvingSupplier ? (
            <p className="text-xs text-slate-400">
              {isInformacja
                ? "Wpisz symbol lub nazwę (min. 2 znaki) — po wyborze uzupełnimy pola i spróbujemy ustawić dostawcę z ZD."
                : "Wpisz symbol lub nazwę (min. 2 znaki) — po wyborze uzupełnimy pola i spróbujemy ustawić dostawcę z ZD."}
            </p>
          ) : null}

          {!delegateAlerts && supplierFeedback ? (
            <SubiektFeedbackAlert feedback={supplierFeedback} compact />
          ) : null}

          {!delegateAlerts && showError ? (
            <SubiektFeedbackAlert feedback={feedback} compact />
          ) : null}
          {!delegateAlerts && showInfo ? (
            <SubiektFeedbackAlert feedback={feedback} compact />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
