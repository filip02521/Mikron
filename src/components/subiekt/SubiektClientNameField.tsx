"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import type { KeyboardEvent } from "react";
import { actionSubiektSuggestClients } from "@/app/actions/subiekt";
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
  const searchGenerationRef = useRef(0);
  const typeaheadId = useId();
  const listboxId = `${typeaheadId}-listbox`;
  const [mounted, setMounted] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [configFeedback, setConfigFeedback] = useState<SubiektFeedback | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SubiektKontrahent[]>([]);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [feedback, setFeedback] = useState<SubiektFeedback | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [, startTransition] = useTransition();

  const debounced = useDebouncedValue(value.trim(), 320);
  const typeaheadListVisible = open && items.length > 0;
  const typeaheadPanelVisible =
    enabled && (status === "loading" || typeaheadListVisible);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
    if (debounced.length < MIN_CLIENT_SEARCH_LENGTH) {
      setItems([]);
      setStatus("idle");
      setFeedback(null);
      setOpen(false);
      return;
    }

    setStatus("loading");
    setFeedback(null);
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
  }, [debounced, enabled]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [items]);

  const pick = useCallback(
    (k: SubiektKontrahent) => {
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
    },
    [onChange, maxLength]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!enabled) return;

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
      if (e.key === "Escape" && (hasList || status === "loading" || open)) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setHighlightedIndex(0);
      }
    },
    [enabled, typeaheadListVisible, items, highlightedIndex, status, open, pick]
  );

  const showFeedbackBelow =
    feedback &&
    items.length === 0 &&
    debounced.length >= MIN_CLIENT_SEARCH_LENGTH &&
    status === "idle";

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
            if (debounced.length >= MIN_CLIENT_SEARCH_LENGTH || items.length > 0) {
              setOpen(true);
            }
          }}
        />
        {enabled && status === "loading" ? (
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
            emptyMessage={status === "loading" ? "Szukam klientów w Subiekcie…" : undefined}
            footer={typeaheadListVisible ? KEYBOARD_HINT : undefined}
          >
            {typeaheadListVisible ? (
              <>
                <TypeaheadSectionLabel>
                  Subiekt — odbiorcy · {formatClientSearchResultCount(items.length)}
                </TypeaheadSectionLabel>
                {items.map((k, index) => {
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

      {showFeedbackBelow && feedback ? (
        <p
          className={cn(
            "text-xs",
            feedback.tone === "error" || feedback.tone === "warning"
              ? "text-amber-800"
              : "text-slate-600"
          )}
        >
          {feedback.message}
          {feedback.hint ? (
            <span className="mt-0.5 block text-slate-500">{feedback.hint}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
