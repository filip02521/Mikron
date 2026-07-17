"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import type { KeyboardEvent } from "react";
import { actionSubiektSuggestProductsForZdLookup } from "@/app/actions/subiekt";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { IconCircleCheck, IconPackage } from "@/components/icons/StrokeIcons";
import { SubiektFeedbackAlert } from "@/components/subiekt/SubiektFeedbackAlert";
import {
  TYPEAHEAD_KEYBOARD_HINT,
  TypeaheadDropdown,
  TypeaheadOption,
  TypeaheadSectionLabel,
} from "@/components/ui/TypeaheadDropdown";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { getSubiektFeedback } from "@/lib/subiekt/feedback";
import {
  buildProductPickFromSubiekt,
  combinedProductSearchDisplay,
  formatSubiektProductOption,
  inferProductZdLookupSearchField,
  minProductSearchLength,
  type ProductSearchField,
} from "@/lib/subiekt/product-pick";
import type { BoardQuestionProductDraft } from "@/lib/department-board/question-product";
import {
  boardQuestionDraftHasProduct,
  boardQuestionDraftLinkedToSubiekt,
  boardQuestionProductLabel,
  boardQuestionProductMetaLines,
} from "@/lib/department-board/question-product";
import { DEPARTMENT_BOARD_QUESTIONS_FORM } from "@/lib/department-board/copy";
import { boardQuestionsFieldLabelClass } from "@/lib/department-board/department-board-questions-ui";
import { NOTATNIK_INPUT_CLASS } from "@/components/notatnik/notatnik-layout";
import { cn } from "@/lib/cn";
import type { SubiektProduct } from "@/lib/subiekt/types";

function typeaheadSectionLabel(
  itemCount: number,
  searchField: Exclude<ProductSearchField, "combined">
): string {
  const countLabel = itemCount === 1 ? "1 wynik" : `${itemCount} wyników`;
  const mode =
    searchField === "plu"
      ? "kod Mikran"
      : searchField === "symbol"
        ? "symbol"
        : "nazwa";
  return `Subiekt — ${mode} · ${countLabel}`;
}

function BoardQuestionProductSelectedCard({
  value,
  linked,
  disabled,
  onChangeProduct,
  onRemove,
}: {
  value: BoardQuestionProductDraft;
  linked: boolean;
  disabled?: boolean;
  onChangeProduct: () => void;
  onRemove: () => void;
}) {
  const label = boardQuestionProductLabel({
    product_symbol: value.symbol,
    product_name: value.product,
    mikran_code: value.mikranCode,
  });
  const meta = boardQuestionProductMetaLines({
    product_symbol: value.symbol,
    product_name: value.product,
    subiekt_tw_id: value.subiektTwId,
    mikran_code: value.mikranCode,
  }).filter((line) => line !== "Powiązano z Subiektem");

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-md border px-3 py-2.5",
        linked
          ? "border-emerald-200/90 bg-emerald-50/70"
          : "border-indigo-200/90 bg-indigo-50/70"
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {linked ? (
          <IconCircleCheck
            size={18}
            strokeWidth={2.25}
            className="mt-0.5 shrink-0 text-emerald-600"
          />
        ) : (
          <IconPackage size={18} className="mt-0.5 shrink-0 text-indigo-600" aria-hidden />
        )}
        <div className="min-w-0 text-xs leading-snug">
          <p
            className={cn(
              "font-semibold",
              linked ? "text-emerald-900" : "text-indigo-900"
            )}
          >
            {linked
              ? DEPARTMENT_BOARD_QUESTIONS_FORM.productLinked
              : DEPARTMENT_BOARD_QUESTIONS_FORM.productSelected}
          </p>
          <p
            className={cn(
              "mt-0.5 text-sm font-medium",
              linked ? "text-emerald-950" : "text-slate-900"
            )}
          >
            {label}
          </p>
          {meta.length ? (
            <p className={cn("mt-1", linked ? "text-emerald-800" : "text-slate-600")}>
              {meta.join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-center">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={cn(
            "h-8",
            linked ? "text-emerald-800 hover:bg-emerald-100/80" : "text-indigo-800 hover:bg-indigo-100/80"
          )}
          disabled={disabled}
          onClick={onChangeProduct}
        >
          {DEPARTMENT_BOARD_QUESTIONS_FORM.productChange}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={cn(
            "h-8",
            linked ? "text-emerald-800 hover:bg-emerald-100/80" : "text-indigo-800 hover:bg-indigo-100/80"
          )}
          disabled={disabled}
          onClick={onRemove}
        >
          {DEPARTMENT_BOARD_QUESTIONS_FORM.productRemove}
        </Button>
      </div>
    </div>
  );
}

export function BoardQuestionProductField({
  value,
  onChange,
  disabled,
  idPrefix,
}: {
  value: BoardQuestionProductDraft;
  onChange: (patch: Partial<BoardQuestionProductDraft>) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const inputAnchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchGenerationRef = useRef(0);
  const typeaheadInstanceId = useId();
  const [enabled, setEnabled] = useState(false);
  const [configFeedback, setConfigFeedback] = useState<SubiektFeedback | null>(null);
  const [productCommitted, setProductCommitted] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SubiektProduct[]>([]);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [feedback, setFeedback] = useState<SubiektFeedback | null>(null);
  const [isPending, startTransition] = useTransition();

  const linked = boardQuestionDraftLinkedToSubiekt(value);
  const hasProduct = boardQuestionDraftHasProduct(value);
  const showSelected = productCommitted && hasProduct;
  const querySource = combinedProductSearchDisplay(value);
  const queryTrimmed = querySource.trim();
  const searchField = inferProductZdLookupSearchField(queryTrimmed);
  const debounced = useDebouncedValue(queryTrimmed, 320);
  const minQueryLen = minProductSearchLength(searchField);
  const searchActive = enabled && !showSelected && debounced.length >= minQueryLen;
  const shortQueryFeedback =
    enabled && !showSelected && debounced.length > 0 && debounced.length < minQueryLen
      ? getSubiektFeedback("short_query")
      : null;
  const visibleItems = searchActive ? items : [];
  const visibleFeedback = searchActive ? feedback : shortQueryFeedback;
  const visibleStatus = searchActive ? (isPending ? "loading" : status) : "idle";
  const itemsKey = visibleItems.map((item) => item.tw_Id).join("\0");
  const [appliedItemsKey, setAppliedItemsKey] = useState(itemsKey);
  if (itemsKey !== appliedItemsKey) {
    setAppliedItemsKey(itemsKey);
    setHighlightedIndex(0);
  }

  useEffect(() => {
    void (async () => {
      const { actionSubiektSuggestionsEnabled } = await import("@/app/actions/subiekt");
      const r = await actionSubiektSuggestionsEnabled();
      setEnabled(r.enabled);
      setConfigFeedback(r.feedback ?? null);
    })();
  }, []);

  const listboxId = `${typeaheadInstanceId}-product`;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (fieldRef.current?.contains(target)) return;
      const listbox = document.getElementById(listboxId);
      if (listbox?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [listboxId]);

  useEffect(() => {
    if (!searchActive) return;

    const generation = ++searchGenerationRef.current;
    startTransition(async () => {
      try {
        const res = await actionSubiektSuggestProductsForZdLookup(debounced);
        if (generation !== searchGenerationRef.current) return;
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
        if (generation === searchGenerationRef.current) {
          setStatus("idle");
        }
      }
    });
  }, [debounced, searchActive]);

  const activeSearchField = inferProductZdLookupSearchField(debounced);

  const typeaheadListVisible = open && visibleItems.length > 0;
  const typeaheadPanelVisible =
    enabled && !showSelected && (visibleStatus === "loading" || typeaheadListVisible);

  const pick = useCallback(
    (product: SubiektProduct) => {
      searchGenerationRef.current++;
      const patch = buildProductPickFromSubiekt(product, "informacja");
      const twId = Number(patch.subiektTwId);
      onChange({
        symbol: patch.symbol,
        product: patch.product,
        subiektTwId: Number.isFinite(twId) && twId > 0 ? twId : null,
        mikranCode: patch.mikranCode,
      });
      setProductCommitted(true);
      setFeedback(null);
      setOpen(false);
      setItems([]);
      setStatus("idle");
      setHighlightedIndex(0);
    },
    [onChange]
  );

  function clearProduct() {
    onChange({
      symbol: "",
      product: "",
      subiektTwId: null,
      mikranCode: "",
    });
    setProductCommitted(false);
    setFeedback(null);
    setOpen(false);
    setItems([]);
  }

  function editProduct() {
    clearProduct();
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function commitFreeTextProductIfNeeded() {
    if (boardQuestionDraftHasProduct(value) && !productCommitted) {
      setProductCommitted(true);
    }
  }

  function onInputBlur() {
    commitFreeTextProductIfNeeded();
  }

  function onInputChange(next: string) {
    setProductCommitted(false);
    onChange({
      symbol: "",
      product: next,
      subiektTwId: null,
      mikranCode: "",
    });
    if (enabled) setOpen(true);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!typeaheadListVisible && visibleStatus !== "loading") return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (typeaheadListVisible) {
        setHighlightedIndex((index) => Math.min(index + 1, visibleItems.length - 1));
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (typeaheadListVisible) {
        setHighlightedIndex((index) => Math.max(index - 1, 0));
      }
    } else if (event.key === "Enter") {
      if (!typeaheadListVisible) return;
      event.preventDefault();
      const item = visibleItems[highlightedIndex];
      if (item) pick(item);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const inputId = `${idPrefix}-product`;

  return (
    <div ref={fieldRef} className="space-y-1.5">
      <label htmlFor={inputId} className={boardQuestionsFieldLabelClass}>
        {DEPARTMENT_BOARD_QUESTIONS_FORM.productLabel}
      </label>

      {showSelected ? (
        <BoardQuestionProductSelectedCard
          value={value}
          linked={linked}
          disabled={disabled}
          onChangeProduct={editProduct}
          onRemove={clearProduct}
        />
      ) : (
        <div
          ref={inputAnchorRef}
          className={cn(
            "relative",
            typeaheadPanelVisible && "z-30 rounded-md ring-2 ring-indigo-400/80 ring-offset-2"
          )}
        >
          <div className="relative w-full">
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              value={querySource}
              onChange={(e) => onInputChange(e.target.value)}
              onBlur={onInputBlur}
              onFocus={() => {
                if (enabled && (visibleItems.length > 0 || visibleStatus === "loading")) {
                  setOpen(true);
                }
              }}
              onKeyDown={onKeyDown}
              disabled={disabled}
              placeholder={DEPARTMENT_BOARD_QUESTIONS_FORM.productPlaceholder}
              className={cn(
                NOTATNIK_INPUT_CLASS,
                "h-9 w-full text-sm",
                enabled && visibleStatus === "loading" ? "pr-10" : undefined
              )}
              autoComplete="off"
              role="combobox"
              aria-expanded={typeaheadPanelVisible}
              aria-controls={typeaheadPanelVisible ? listboxId : undefined}
            />
            {enabled && visibleStatus === "loading" ? (
              <span className="pointer-events-none absolute right-2.5 top-1/2 z-[1] -translate-y-1/2">
                <Spinner size="sm" />
              </span>
            ) : null}
          </div>

          <TypeaheadDropdown
            open={typeaheadPanelVisible}
            listboxId={listboxId}
            portalled
            anchorRef={inputAnchorRef}
            size="comfortable"
            emptyMessage={
              visibleStatus === "loading"
                ? DEPARTMENT_BOARD_QUESTIONS_FORM.productSearchLoading
                : visibleFeedback?.tone === "info"
                  ? visibleFeedback.message
                  : undefined
            }
            footer={typeaheadListVisible ? TYPEAHEAD_KEYBOARD_HINT : undefined}
          >
            {typeaheadListVisible ? (
              <>
                <TypeaheadSectionLabel>
                  {typeaheadSectionLabel(visibleItems.length, activeSearchField)}
                </TypeaheadSectionLabel>
                {visibleItems.map((item, index) => {
                  const option = formatSubiektProductOption(item);
                  return (
                    <TypeaheadOption
                      key={item.tw_Id}
                      optionId={`${listboxId}-opt-${index}`}
                      title={option.title}
                      subtitle={option.subtitle}
                      badge="towar"
                      size="comfortable"
                      highlighted={index === highlightedIndex}
                      onHighlight={() => setHighlightedIndex(index)}
                      onSelect={() => pick(item)}
                    />
                  );
                })}
              </>
            ) : null}
          </TypeaheadDropdown>
        </div>
      )}

      {configFeedback ? <SubiektFeedbackAlert feedback={configFeedback} /> : null}
      {visibleFeedback && visibleFeedback.tone !== "info" ? (
        <SubiektFeedbackAlert feedback={visibleFeedback} />
      ) : null}
    </div>
  );
}
