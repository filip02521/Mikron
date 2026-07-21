"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import type { KeyboardEvent } from "react";
import { actionSubiektSuggestClients } from "@/app/actions/subiekt";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import {
  TypeaheadDropdown,
  TypeaheadOption,
  TypeaheadSectionLabel,
} from "@/components/ui/TypeaheadDropdown";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  formatClientSearchResultCount,
  formatSubiektKontrahentOption,
  MIN_CLIENT_SEARCH_LENGTH,
  shouldRunSubiektClientSearch,
} from "@/lib/subiekt/client-pick";
import { formatSubiektKontrahentLabel } from "@/lib/subiekt/match-supplier";
import { normalizeSalesClientName } from "@/lib/orders/sales-client-label";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import type { SubiektKontrahent } from "@/lib/subiekt/types";
import { cn } from "@/lib/cn";

const KEYBOARD_HINT = "↑↓ wybierz · Enter zatwierdź · Esc zamknij";

export function SubiektClientNameField({
  value,
  clientKhId = null,
  onChange,
  disabled,
  maxLength,
  placeholder = "dla kogo jest ten towar — pojawi się w mailu po dostawie",
}: {
  value: string;
  clientKhId?: number | null;
  onChange: (patch: { clientName: string; clientKhId: number | null }) => void;
  disabled?: boolean;
  maxLength: number;
  placeholder?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const searchGenerationRef = useRef(0);
  const typeaheadId = useId();
  const listboxId = `${typeaheadId}-listbox`;
  const mounted = useClientHydrated();

  const [enabled, setEnabled] = useState(false);
  const [configFeedback, setConfigFeedback] = useState<SubiektFeedback | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SubiektKontrahent[]>([]);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [feedback, setFeedback] = useState<SubiektFeedback | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isPending, startTransition] = useTransition();

  const debounced = useDebouncedValue(value.trim(), 320);
  const searchActive =
    enabled && shouldRunSubiektClientSearch(debounced, clientKhId);
  const visibleItems = useMemo(
    () => (searchActive ? items : []),
    [items, searchActive]
  );
  const visibleFeedback = searchActive ? feedback : null;
  const visibleStatus = searchActive ? (isPending ? "loading" : status) : "idle";
  const itemsKey = visibleItems.map((item) => item.kh_Id).join("\0");
  const [appliedItemsKey, setAppliedItemsKey] = useState(itemsKey);
  if (itemsKey !== appliedItemsKey) {
    setAppliedItemsKey(itemsKey);
    setHighlightedIndex(0);
  }
  const typeaheadListVisible = open && visibleItems.length > 0;
  const typeaheadPanelVisible =
    enabled && (visibleStatus === "loading" || typeaheadListVisible);

  useEffect(() => {
    void (async () => {
      const { actionSubiektSuggestionsEnabled } = await import("@/app/actions/subiekt");
      const r = await actionSubiektSuggestionsEnabled();
      setEnabled(r.enabled);
      setConfigFeedback(r.feedback ?? null);
    })();
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
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
        const res = await actionSubiektSuggestClients(debounced);
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
  }, [debounced, searchActive, clientKhId]);

  const pick = useCallback(
    (k: SubiektKontrahent) => {
      searchGenerationRef.current++;
      const label = formatSubiektKontrahentLabel(k);
      const kh = Math.trunc(Number(k.kh_Id));
      onChange({
        clientName: normalizeSalesClientName(label) ?? label.slice(0, maxLength),
        clientKhId: Number.isFinite(kh) && kh > 0 ? kh : null,
      });
      setOpen(false);
      setItems([]);
      setFeedback(null);
      setHighlightedIndex(0);
      setStatus("idle");
    },
    [onChange, maxLength]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!enabled) return;

      const hasList = typeaheadListVisible;

      if (e.key === "ArrowDown" && hasList) {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, visibleItems.length - 1));
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
        const chosen = visibleItems[highlightedIndex];
        if (chosen) pick(chosen);
        return;
      }
      if (e.key === "Escape" && (hasList || visibleStatus === "loading" || open)) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setHighlightedIndex(0);
      }
    },
    [enabled, typeaheadListVisible, visibleItems, highlightedIndex, visibleStatus, open, pick]
  );

  const showFeedbackBelow =
    visibleFeedback &&
    visibleItems.length === 0 &&
    searchActive &&
    visibleStatus === "idle";

  const comboboxA11y = mounted
    ? {
        role: "combobox" as const,
        "aria-expanded": typeaheadPanelVisible,
        "aria-controls": typeaheadPanelVisible ? listboxId : undefined,
        "aria-activedescendant": typeaheadListVisible
          ? `${listboxId}-opt-${highlightedIndex}`
          : undefined,
      }
    : {};

  return (
    <div ref={rootRef} className="space-y-1.5">
      <div
        ref={anchorRef}
        className={cn(
          "relative rounded-md transition-[box-shadow]",
          typeaheadPanelVisible && "z-30 ring-2 ring-indigo-400/80 ring-offset-2"
        )}
      >
        <Input
          disabled={disabled}
          placeholder={placeholder}
          maxLength={maxLength}
          value={value}
          autoComplete="off"
          onKeyDown={handleKeyDown}
          aria-autocomplete="list"
          {...comboboxA11y}
          onChange={(e) => {
            onChange({ clientName: e.target.value, clientKhId: null });
            setOpen(true);
          }}
          onFocus={() => {
            if (debounced.length >= MIN_CLIENT_SEARCH_LENGTH || visibleItems.length > 0) {
              setOpen(true);
            }
          }}
        />
        {enabled && visibleStatus === "loading" ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner size="sm" />
          </span>
        ) : null}
        {clientKhId != null && clientKhId > 0 && !typeaheadPanelVisible ? (
          <span
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-emerald-700"
            title="Powiązano z kartoteką Subiekta"
          >
            Subiekt
          </span>
        ) : null}

        {typeaheadPanelVisible ? (
          <TypeaheadDropdown
            open
            listboxId={listboxId}
            portalled
            anchorRef={anchorRef}
            emptyMessage={visibleStatus === "loading" ? "Szukam klientów w Subiekcie…" : undefined}
            footer={typeaheadListVisible ? KEYBOARD_HINT : undefined}
          >
            {typeaheadListVisible ? (
              <>
                <TypeaheadSectionLabel>
                  Subiekt — odbiorcy · {formatClientSearchResultCount(visibleItems.length)}
                </TypeaheadSectionLabel>
                {visibleItems.map((k, index) => {
                  const { title, subtitle } = formatSubiektKontrahentOption(k);
                  return (
                    <TypeaheadOption
                      key={k.kh_Id}
                      optionId={`${listboxId}-opt-${index}`}
                      title={title}
                      subtitle={subtitle}
                      badge="klient"
                      highlighted={highlightedIndex === index}
                      onHighlight={() => setHighlightedIndex(index)}
                      onSelect={() => pick(k)}
                    />
                  );
                })}
              </>
            ) : null}
          </TypeaheadDropdown>
        ) : null}
      </div>

      {enabled ? (
        <p className="text-xs text-slate-500">
          Wpisz min. {MIN_CLIENT_SEARCH_LENGTH} znaki, aby wyszukać w Subiekcie — lub wpisz dowolną
          nazwę ręcznie.
        </p>
      ) : configFeedback ? (
        <p className="text-xs text-slate-500">{configFeedback.message}</p>
      ) : null}

      {showFeedbackBelow && visibleFeedback ? (
        <p
          className={cn(
            "text-xs",
            visibleFeedback.tone === "error" || visibleFeedback.tone === "warning"
              ? "text-amber-800"
              : "text-slate-600"
          )}
        >
          {visibleFeedback.message}
          {visibleFeedback.hint ? (
            <span className="mt-0.5 block text-slate-500">{visibleFeedback.hint}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
