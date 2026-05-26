"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { actionSubiektSuggestProducts } from "@/app/actions/subiekt";
import type { IndividualRequestKind } from "@/types/database";
import { Field, Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { IconCircleCheck } from "@/components/icons/StrokeIcons";
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
  minProductSearchLength,
  type ProductSearchField,
} from "@/lib/subiekt/product-pick";
import { cn } from "@/lib/cn";
import {
  ProsbaLineFieldMessages,
  type ProsbaLineMessageItem,
} from "@/components/orders/ProsbaLineFieldMessages";
import type { ProsbaLineFieldMap } from "@/lib/orders/prosba-line-field-validation";
import {
  MAX_MIKRAN_CODE_LEN,
  MAX_PRODUCT_TEXT_LEN,
  MAX_QUANTITY_LEN,
  MAX_SYMBOL_LEN,
} from "@/lib/security/text-limits";
import type { AppSupplierRef } from "@/lib/subiekt/match-supplier";
import type { SubiektProduct } from "@/lib/subiekt/types";

export type SubiektProductLineValue = {
  symbol: string;
  mikranCode: string;
  product: string;
  quantity: string;
  subiektTwId?: number | null;
};

type ActiveField = ProductSearchField;

function SubiektFieldAdornment({
  linked,
  loading,
}: {
  linked: boolean;
  loading: boolean;
}) {
  if (linked) {
    return (
      <span
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600"
        title="Wybrano z Subiekta"
        aria-label="Wybrano z Subiekta"
      >
        <IconCircleCheck size={18} strokeWidth={2.25} />
      </span>
    );
  }
  if (loading) {
    return (
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
        <Spinner size="sm" />
      </span>
    );
  }
  return null;
}

function activeFieldQuery(value: SubiektProductLineValue, field: ActiveField): string {
  if (field === "symbol") return value.symbol;
  if (field === "plu") return value.mikranCode;
  return value.product;
}

function typeaheadSectionLabel(field: ActiveField): string {
  if (field === "plu") return "po kodzie Mikran";
  if (field === "name") return "po nazwie";
  return "po symbolu";
}

function subiektFieldLabel(field: ActiveField): string {
  if (field === "plu") return "Kod mikran";
  if (field === "name") return "Produkt";
  return "Symbol";
}

function prosbaFieldProps(
  key: keyof ProsbaLineFieldMap,
  validation?: ProsbaLineFieldMap
): { state?: "default" | "warning" | "error" | "success"; error?: string; hint?: string } {
  const v = validation?.[key];
  if (!v || v.state === "default") return {};
  const sharedProductMessage = v.message?.includes("symbol, kod Mikran");
  if (sharedProductMessage && key !== "product") {
    return { state: v.state };
  }
  return { state: v.state, error: v.message };
}

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
  deferSupplierResolve = false,
  fieldValidation,
  lineIndex = 0,
}: {
  value: SubiektProductLineValue;
  onChange: (patch: Partial<SubiektProductLineValue>) => void;
  requestKind: IndividualRequestKind;
  disabled?: boolean;
  appearance?: "default" | "prosba";
  productFieldClassName?: string;
  suppliers?: AppSupplierRef[];
  onSupplierResolved?: (result: {
    supplierId: string;
    supplierName: string;
    documentNumber: string | null;
  }) => void;
  onSupplierResolveFeedback?: (feedback: SubiektFeedback | null) => void;
  delegateAlerts?: boolean;
  onProductFeedbackChange?: (feedback: SubiektFeedback | null) => void;
  onConfigFeedbackChange?: (feedback: SubiektFeedback | null) => void;
  onResolvingSupplierChange?: (resolving: boolean) => void;
  deferSupplierResolve?: boolean;
  /** Stany pól (prośba handlowca). */
  fieldValidation?: ProsbaLineFieldMap;
  lineIndex?: number;
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

  const querySource = activeFieldQuery(value, activeField);
  const debounced = useDebouncedValue(querySource.trim(), 320);
  const prosba = appearance === "prosba";
  const isInformacja = requestKind === "informacja";
  const linkedFromSubiekt = value.subiektTwId != null;
  const minQueryLen = minProductSearchLength(activeField);

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
      setStatus("idle");
      return;
    }
    if (linkedFromSubiekt) {
      setStatus("idle");
      setItems([]);
      setOpen(false);
      setFeedback(null);
      return;
    }
    if (debounced.length < minQueryLen) {
      setItems([]);
      setStatus("idle");
      setFeedback(
        debounced.length > 0 && debounced.length < minQueryLen
          ? getSubiektFeedback("short_query")
          : null
      );
      return;
    }

    setStatus("loading");
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await actionSubiektSuggestProducts(debounced, activeField);
        if (!res.ok) {
          setItems([]);
          setFeedback(res.feedback);
          setOpen(false);
          return;
        }
        setItems(res.items);
        setFeedback(res.feedback ?? null);
        setOpen(res.items.length > 0);
      } finally {
        setStatus("idle");
      }
    });
  }, [debounced, enabled, linkedFromSubiekt, activeField, minQueryLen]);

  const pick = (p: SubiektProduct) => {
    const patch = buildProductPickFromSubiekt(p, requestKind, value.quantity);
    onChange({ ...patch, subiektTwId: patch.subiektTwId });
    setFeedback(null);
    setOpen(false);
    setItems([]);
    setStatus("idle");

    if (deferSupplierResolve || !suppliers?.length || !onSupplierResolved) return;

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
  const productFieldFeedback =
    feedback && (showError || showInfo) && !linkedFromSubiekt ? feedback : null;

  const symbolField = prosbaFieldProps("symbol", fieldValidation);
  const mikranField = prosbaFieldProps("mikranCode", fieldValidation);
  const productField = prosbaFieldProps("product", fieldValidation);
  const quantityField = prosbaFieldProps("quantity", fieldValidation);

  const prosbaMessageItems: ProsbaLineMessageItem[] = [];
  if (prosba) {
    if (resolvingSupplier) {
      prosbaMessageItems.push({ kind: "resolving" });
    }
    if (supplierFeedback) {
      prosbaMessageItems.push({ kind: "feedback", feedback: supplierFeedback });
    }
    if (productFieldFeedback) {
      prosbaMessageItems.push({
        kind: "feedback",
        feedback: productFieldFeedback,
        fieldLabel: `Subiekt — ${subiektFieldLabel(activeField)}`,
      });
    }
    if (
      enabled &&
      !productFieldFeedback &&
      !resolvingSupplier &&
      !linkedFromSubiekt &&
      !Object.values(fieldValidation ?? {}).some((f) => f.state !== "default")
    ) {
      prosbaMessageItems.push({
        kind: "hint",
        text: deferSupplierResolve
          ? isInformacja
            ? "Wpisz symbol, kod Mikran (min. 1 cyfra) lub nazwę (min. 2 znaki) — po wyborze towaru możesz od razu wysłać prośbę; dostawcę dopasujemy w tle."
            : "Wpisz symbol, kod Mikran (min. 1 cyfra) lub nazwę (min. 2 znaki) — po wyborze towaru możesz od razu wysłać prośbę; dostawcę dopasujemy w tle z Subiekta."
          : isInformacja
            ? "Wpisz symbol, kod Mikran lub nazwę — po wyborze uzupełnimy pola i spróbujemy ustawić dostawcę z ZD."
            : "Wpisz symbol, kod Mikran lub nazwę — po wyborze uzupełnimy pola i spróbujemy ustawić dostawcę z ZD.",
      });
    }
  }

  const symbolPluRow = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field
        label="Symbol"
        {...symbolField}
        hint={
          prosba && !symbolField.error && !symbolField.state
            ? enabled
              ? "Symbol z kartoteki Subiekta (min. 2 znaki)"
              : "Symbol towaru (wpis ręczny)"
            : undefined
        }
      >
        <div className="relative">
          <Input
            disabled={disabled}
            placeholder="np. ABC"
            maxLength={MAX_SYMBOL_LEN}
            value={value.symbol}
            autoComplete="off"
            state={symbolField.state}
            onChange={(e) => {
              manualPatch({ symbol: e.target.value }, true);
              setActiveField("symbol");
              setOpen(true);
            }}
            onFocus={() => {
              if (linkedFromSubiekt) return;
              setActiveField("symbol");
              setOpen(true);
            }}
          />
          <SubiektFieldAdornment
            linked={linkedFromSubiekt}
            loading={activeField === "symbol" && status === "loading"}
          />
        </div>
      </Field>

      <Field
        label="Kod mikran"
        {...mikranField}
        hint={
          prosba && !mikranField.error && !mikranField.state
            ? enabled
              ? "Numer PLU / tw_PLU (min. 1 cyfra)"
              : "Numer PLU / kod Mikran (wpis ręczny)"
            : undefined
        }
      >
        <div className="relative">
          <Input
            disabled={disabled}
            placeholder="np. 896"
            inputMode="numeric"
            maxLength={MAX_MIKRAN_CODE_LEN}
            value={value.mikranCode}
            autoComplete="off"
            state={mikranField.state}
            onChange={(e) => {
              manualPatch({ mikranCode: e.target.value }, true);
              setActiveField("plu");
              setOpen(true);
            }}
            onFocus={() => {
              if (linkedFromSubiekt) return;
              setActiveField("plu");
              setOpen(true);
            }}
          />
          <SubiektFieldAdornment
            linked={linkedFromSubiekt}
            loading={activeField === "plu" && status === "loading"}
          />
        </div>
      </Field>
    </div>
  );

  return (
    <div ref={ref} className="relative space-y-3">
      {prosba ? (
        <>
          {symbolPluRow}
          <Field
            label={isInformacja ? "Produkt (co ma być na stanie)" : "Produkty"}
            className={productFieldClassName}
            {...productField}
            hint={
              prosba && !productField.error && !productField.state
                ? enabled
                  ? "Nazwa lub opis produktu (min. 2 znaki do wyszukiwania)"
                  : "Nazwa lub opis produktu (wpis ręczny)"
                : undefined
            }
          >
            <div className="relative">
              <Input
                disabled={disabled}
                placeholder={
                  isInformacja
                    ? "Nazwa z Subiekta…"
                    : enabled
                      ? "Nazwa z Subiekta…"
                      : "Opis produktów"
                }
                maxLength={MAX_PRODUCT_TEXT_LEN}
                value={value.product}
                autoComplete="off"
                state={productField.state}
                onChange={(e) => {
                  manualPatch({ product: e.target.value }, true);
                  setActiveField("name");
                  setOpen(true);
                }}
                onFocus={() => {
                  if (linkedFromSubiekt) return;
                  setActiveField("name");
                  setOpen(true);
                }}
              />
              <SubiektFieldAdornment
                linked={linkedFromSubiekt}
                loading={activeField === "name" && status === "loading"}
              />
            </div>
          </Field>
          {!isInformacja ? (
            <Field
              label="Ilość (wymagane)"
              {...quantityField}
              hint={
                prosba && !quantityField.error && !quantityField.state
                  ? "Liczba sztuk do zamówienia u dostawcy"
                  : undefined
              }
            >
              <Input
                type="number"
                min={1}
                step={1}
                required
                disabled={disabled}
                maxLength={MAX_QUANTITY_LEN}
                placeholder="np. 1"
                value={value.quantity}
                state={quantityField.state}
                onChange={(e) => onChange({ quantity: e.target.value })}
              />
            </Field>
          ) : null}

          {prosbaMessageItems.length > 0 ? (
            <ProsbaLineFieldMessages
              lineLabel={`Informacje — produkt ${lineIndex + 1}`}
              items={prosbaMessageItems}
            />
          ) : null}
        </>
      ) : (
        <div
          className={cn(
            "grid gap-3",
            isInformacja ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"
          )}
        >
          <Field label="Symbol">
            <div className="relative">
              <Input
                disabled={disabled}
                placeholder="np. ABC"
                maxLength={MAX_SYMBOL_LEN}
                value={value.symbol}
                autoComplete="off"
                onChange={(e) => {
                  manualPatch({ symbol: e.target.value }, true);
                  setActiveField("symbol");
                  setOpen(true);
                }}
                onFocus={() => {
                  if (linkedFromSubiekt) return;
                  setActiveField("symbol");
                  setOpen(true);
                }}
              />
              <SubiektFieldAdornment
                linked={linkedFromSubiekt}
                loading={activeField === "symbol" && status === "loading"}
              />
            </div>
          </Field>

          <Field label="Kod mikran">
            <div className="relative">
              <Input
                disabled={disabled}
                placeholder="np. 896"
                inputMode="numeric"
                maxLength={MAX_MIKRAN_CODE_LEN}
                value={value.mikranCode}
                autoComplete="off"
                onChange={(e) => {
                  manualPatch({ mikranCode: e.target.value }, true);
                  setActiveField("plu");
                  setOpen(true);
                }}
                onFocus={() => {
                  if (linkedFromSubiekt) return;
                  setActiveField("plu");
                  setOpen(true);
                }}
              />
              <SubiektFieldAdornment
                linked={linkedFromSubiekt}
                loading={activeField === "plu" && status === "loading"}
              />
            </div>
          </Field>

          <Field
            label={isInformacja ? "Produkt (co ma być na stanie)" : "Produkty"}
            className={cn(productFieldClassName, "sm:col-span-2 lg:col-span-1")}
          >
            <div className="relative">
              <Input
                disabled={disabled}
                placeholder={
                  isInformacja
                    ? "Nazwa z Subiekta…"
                    : enabled
                      ? "Nazwa z Subiekta…"
                      : "Opis produktów"
                }
                maxLength={MAX_PRODUCT_TEXT_LEN}
                value={value.product}
                autoComplete="off"
                onChange={(e) => {
                  manualPatch({ product: e.target.value }, true);
                  setActiveField("name");
                  setOpen(true);
                }}
                onFocus={() => {
                  if (linkedFromSubiekt) return;
                  setActiveField("name");
                  setOpen(true);
                }}
              />
              <SubiektFieldAdornment
                linked={linkedFromSubiekt}
                loading={activeField === "name" && status === "loading"}
              />
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
      )}

      {!enabled && configFeedback && !delegateAlerts && !prosba ? (
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
              Subiekt — {typeaheadSectionLabel(activeField)}
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

          {!delegateAlerts && !prosba && !feedback && !resolvingSupplier && !linkedFromSubiekt ? (
            <p className="text-xs text-slate-400">
              {deferSupplierResolve
                ? isInformacja
                  ? "Wpisz symbol, kod Mikran (min. 1 cyfra) lub nazwę (min. 2 znaki) — po wyborze towaru możesz od razu wysłać prośbę; dostawcę dopasujemy w tle."
                  : "Wpisz symbol, kod Mikran (min. 1 cyfra) lub nazwę (min. 2 znaki) — po wyborze towaru możesz wysłać prośbę; dostawcę dopasujemy w tle z Subiekta."
                : isInformacja
                  ? "Wpisz symbol, kod Mikran lub nazwę — po wyborze uzupełnimy pola i spróbujemy ustawić dostawcę z ZD."
                  : "Wpisz symbol, kod Mikran lub nazwę — po wyborze uzupełnimy pola i spróbujemy ustawić dostawcę z ZD."}
            </p>
          ) : null}

          {!delegateAlerts && !prosba && supplierFeedback ? (
            <SubiektFeedbackAlert feedback={supplierFeedback} compact />
          ) : null}

          {!delegateAlerts && !prosba && showError ? (
            <SubiektFeedbackAlert feedback={feedback} compact />
          ) : null}
          {!delegateAlerts && !prosba && showInfo ? (
            <SubiektFeedbackAlert feedback={feedback} compact />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
