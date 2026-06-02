"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import type { KeyboardEvent, ReactNode } from "react";
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

const TYPEAHEAD_KEYBOARD_HINT = "↑↓ wybierz · Enter zatwierdź · Esc zamknij";

function SubiektSearchFieldSlot({
  field,
  activeField,
  panelVisible,
  panel,
  children,
}: {
  field: ActiveField;
  activeField: ActiveField;
  panelVisible: boolean;
  panel: React.ReactNode;
  children: ReactNode;
}) {
  const isActive = activeField === field;
  const showChrome = isActive && panelVisible;

  return (
    <div
      className={cn(
        "relative rounded-md transition-[box-shadow]",
        showChrome && "z-30 ring-2 ring-indigo-400/80 ring-offset-2"
      )}
    >
      {children}
      {isActive ? panel : null}
    </div>
  );
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
  onSupplierMappingMissing,
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
  /** Gdy po wyborze z Subiekta nie ma dostawcy w bazie — np. wyczyść pole dostawcy w formularzu zakupów. */
  onSupplierMappingMissing?: () => void;
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
  const typeaheadInstanceId = useId();
  const [enabled, setEnabled] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
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
        setHighlightedIndex(0);
      } finally {
        setStatus("idle");
      }
    });
  }, [debounced, enabled, linkedFromSubiekt, activeField, minQueryLen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [items, activeField]);

  const typeaheadListVisible = open && items.length > 0;
  const typeaheadPanelVisible =
    enabled &&
    !linkedFromSubiekt &&
    (status === "loading" || typeaheadListVisible);

  const listboxId = `${typeaheadInstanceId}-${activeField}`;

  const pick = (p: SubiektProduct) => {
    const patch = buildProductPickFromSubiekt(p, requestKind, value.quantity);
    onChange({ ...patch, subiektTwId: patch.subiektTwId });
    setFeedback(null);
    setOpen(false);
    setItems([]);
    setStatus("idle");
    setHighlightedIndex(0);

    if (!suppliers?.length || !onSupplierResolved) return;

    // Nowe podejście: dopasowanie dostawcy robimy po naszej bazie (product_supplier_links),
    // więc jest szybkie. Dla prośby handlowca robimy to "po cichu" (bez spinnera),
    // a jeśli nie ma mapowania — pozycja zostaje do weryfikacji.
    const silentResolve = deferSupplierResolve;
    if (!silentResolve) {
      setResolvingSupplier(true);
      setSupplierFeedback(null);
      onSupplierResolveFeedback?.(null);
    }
    onResolvingSupplierChange?.(true);
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
          if (!silentResolve) {
            setSupplierFeedback(null);
            onSupplierResolveFeedback?.(null);
            try {
              const { actionRecordCatalogFromSubiektPick } = await import(
                "@/app/actions/subiekt"
              );
              const twId = Number((p as { tw_Id?: unknown }).tw_Id);
              if (Number.isFinite(twId) && twId > 0) {
                await actionRecordCatalogFromSubiektPick({
                  subiektTwId: twId,
                  symbol: patch.symbol,
                  productName: patch.product,
                  mikranCode: patch.mikranCode,
                  supplierId: res.supplierId,
                });
              }
            } catch {
              /* katalog — best effort */
            }
          }
        } else {
          if (!silentResolve) {
            onSupplierMappingMissing?.();
            if (!delegateAlerts) setSupplierFeedback(res.feedback);
            onSupplierResolveFeedback?.(res.feedback);
          }
        }
      } finally {
        onResolvingSupplierChange?.(false);
        if (!silentResolve) setResolvingSupplier(false);
      }
    });
  };

  const manualPatch = (
    patch: Partial<SubiektProductLineValue>,
    clearSubiekt = false
  ) => {
    onChange(clearSubiekt ? { ...patch, subiektTwId: null } : patch);
  };

  const handleTypeaheadKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!enabled || linkedFromSubiekt) return;

      const hasList = typeaheadListVisible;

      if (e.key === "ArrowDown" && hasList) {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, items.length - 1));
        return;
      }
      if (e.key === "ArrowUp" && hasList) {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && hasList) {
        e.preventDefault();
        e.stopPropagation();
        const chosen = items[highlightedIndex];
        if (chosen) pick(chosen);
        return;
      }
      if (
        e.key === "Escape" &&
        (hasList || status === "loading" || open)
      ) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setHighlightedIndex(0);
      }
    },
    [
      enabled,
      linkedFromSubiekt,
      typeaheadListVisible,
      items,
      highlightedIndex,
      status,
      open,
      pick,
    ]
  );

  const typeaheadInputA11y = (field: ActiveField) => {
    const isActive = activeField === field;
    const fieldPanelOpen = isActive && typeaheadPanelVisible;
    return {
      "aria-autocomplete": "list" as const,
      "aria-expanded": fieldPanelOpen,
      "aria-controls": fieldPanelOpen ? listboxId : undefined,
      "aria-activedescendant":
        isActive && typeaheadListVisible
          ? `${listboxId}-opt-${highlightedIndex}`
          : undefined,
    };
  };

  const renderTypeaheadPanel = (field: ActiveField) => {
    if (activeField !== field || !typeaheadPanelVisible) return null;

    const resultLabel =
      items.length === 1 ? "1 wynik" : `${items.length} wyników`;

    return (
      <TypeaheadDropdown
        open
        listboxId={listboxId}
        emptyMessage={status === "loading" ? "Szukam w Subiekcie…" : undefined}
        footer={typeaheadListVisible ? TYPEAHEAD_KEYBOARD_HINT : undefined}
      >
        {typeaheadListVisible ? (
          <>
            <TypeaheadSectionLabel>
              Subiekt — {typeaheadSectionLabel(field)} · {resultLabel}
            </TypeaheadSectionLabel>
            {items.map((p, index) => {
              const { title, subtitle } = formatSubiektProductOption(p);
              return (
                <TypeaheadOption
                  key={p.tw_Id}
                  optionId={`${listboxId}-opt-${index}`}
                  title={title}
                  subtitle={subtitle}
                  badge="towar"
                  highlighted={highlightedIndex === index}
                  onHighlight={() => setHighlightedIndex(index)}
                  onSelect={() => pick(p)}
                />
              );
            })}
          </>
        ) : null}
      </TypeaheadDropdown>
    );
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
        text: "Wpisz symbol, kod Mikran lub nazwę — lista pojawi się pod polem. Strzałki ↑↓ i Enter wybierają towar z Subiekta.",
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
        <SubiektSearchFieldSlot
          field="symbol"
          activeField={activeField}
          panelVisible={typeaheadPanelVisible}
          panel={renderTypeaheadPanel("symbol")}
        >
          <Input
            disabled={disabled}
            placeholder="np. ABC"
            maxLength={MAX_SYMBOL_LEN}
            value={value.symbol}
            autoComplete="off"
            state={symbolField.state}
            onKeyDown={handleTypeaheadKeyDown}
            {...typeaheadInputA11y("symbol")}
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
        </SubiektSearchFieldSlot>
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
        <SubiektSearchFieldSlot
          field="plu"
          activeField={activeField}
          panelVisible={typeaheadPanelVisible}
          panel={renderTypeaheadPanel("plu")}
        >
          <Input
            disabled={disabled}
            placeholder="np. 896"
            inputMode="numeric"
            maxLength={MAX_MIKRAN_CODE_LEN}
            value={value.mikranCode}
            autoComplete="off"
            state={mikranField.state}
            onKeyDown={handleTypeaheadKeyDown}
            {...typeaheadInputA11y("plu")}
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
        </SubiektSearchFieldSlot>
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
            <SubiektSearchFieldSlot
              field="name"
              activeField={activeField}
              panelVisible={typeaheadPanelVisible}
              panel={renderTypeaheadPanel("name")}
            >
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
                onKeyDown={handleTypeaheadKeyDown}
                {...typeaheadInputA11y("name")}
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
            </SubiektSearchFieldSlot>
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
            <SubiektSearchFieldSlot
              field="symbol"
              activeField={activeField}
              panelVisible={typeaheadPanelVisible}
              panel={renderTypeaheadPanel("symbol")}
            >
              <Input
                disabled={disabled}
                placeholder="np. ABC"
                maxLength={MAX_SYMBOL_LEN}
                value={value.symbol}
                autoComplete="off"
                onKeyDown={handleTypeaheadKeyDown}
                {...typeaheadInputA11y("symbol")}
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
            </SubiektSearchFieldSlot>
          </Field>

          <Field label="Kod mikran">
            <SubiektSearchFieldSlot
              field="plu"
              activeField={activeField}
              panelVisible={typeaheadPanelVisible}
              panel={renderTypeaheadPanel("plu")}
            >
              <Input
                disabled={disabled}
                placeholder="np. 896"
                inputMode="numeric"
                maxLength={MAX_MIKRAN_CODE_LEN}
                value={value.mikranCode}
                autoComplete="off"
                onKeyDown={handleTypeaheadKeyDown}
                {...typeaheadInputA11y("plu")}
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
            </SubiektSearchFieldSlot>
          </Field>

          <Field
            label={isInformacja ? "Produkt (co ma być na stanie)" : "Produkty"}
            className={cn(productFieldClassName, "sm:col-span-2 lg:col-span-1")}
          >
            <SubiektSearchFieldSlot
              field="name"
              activeField={activeField}
              panelVisible={typeaheadPanelVisible}
              panel={renderTypeaheadPanel("name")}
            >
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
                onKeyDown={handleTypeaheadKeyDown}
                {...typeaheadInputA11y("name")}
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
            </SubiektSearchFieldSlot>
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
          {!delegateAlerts && !prosba && !feedback && !resolvingSupplier && !linkedFromSubiekt ? (
            <p className="text-xs text-slate-400">
              Wpisz symbol, kod Mikran lub nazwę, aby wyszukać w Subiekcie.
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
