"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import {
  actionSubiektSuggestSuppliers,
  type SubiektSupplierSuggestion,
} from "@/app/actions/subiekt";
import { SubiektFeedbackAlert } from "@/components/subiekt/SubiektFeedbackAlert";
import { Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import {
  TYPEAHEAD_KEYBOARD_HINT,
  TypeaheadDropdown,
  TypeaheadInfoRow,
  TypeaheadOption,
  TypeaheadSectionLabel,
} from "@/components/ui/TypeaheadDropdown";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { filterSuppliersByName } from "@/lib/orders/filter-suppliers";
import { cn } from "@/lib/cn";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";

export type SupplierPickerOption = {
  id: string;
  name: string;
  subiektKhId?: number | null;
};

const SUBIEKT_DEBOUNCE_MS = 450;
const SUBIEKT_MIN_QUERY_LEN = 2;

export function SupplierPickerField({
  suppliers,
  value,
  onChange,
  disabled,
  placeholder = "Szukaj dostawcy…",
  allowEmpty = true,
  emptyLabel = "Wybierz później / nie wiem",
  showInlineFeedback = true,
  onSubiektFeedbackChange,
  dropdownSize = "default",
  portalled = true,
}: {
  suppliers: SupplierPickerOption[];
  value: string;
  onChange: (supplierId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  /** false — komunikaty idą do rodzica (RequestFormStatusPanel) */
  showInlineFeedback?: boolean;
  onSubiektFeedbackChange?: (feedbacks: SubiektFeedback[]) => void;
  dropdownSize?: "default" | "comfortable";
  /** Portal do body — omija overflow w modalach (domyślnie włączony). */
  portalled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const typeaheadId = useId();
  const listboxId = `${typeaheadId}-listbox`;
  const subiektRequestId = useRef(0);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [subiektRows, setSubiektRows] = useState<SubiektSupplierSuggestion[]>([]);
  const [feedback, setFeedback] = useState<SubiektFeedback | null>(null);
  const [subiektWarning, setSubiektWarning] = useState<SubiektFeedback | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const debouncedForSubiekt = useDebouncedValue(query.trim(), SUBIEKT_DEBOUNCE_MS);

  const selected = useMemo(
    () => suppliers.find((s) => s.id === value),
    [suppliers, value]
  );

  const sorted = useMemo(
    () => [...suppliers].sort((a, b) => a.name.localeCompare(b.name, "pl")),
    [suppliers]
  );

  const localMatches = useMemo(
    () => filterSuppliersByName(sorted, query, 12),
    [query, sorted]
  );

  const appRows: SubiektSupplierSuggestion[] = useMemo(
    () =>
      localMatches.map((s) => ({
        supplierId: s.id,
        label: s.name,
        source: "app" as const,
      })),
    [localMatches]
  );

  const shownSubiektRows = useMemo(() => {
    const localIds = new Set(appRows.map((r) => r.supplierId).filter(Boolean));
    return subiektRows.filter((r) => !r.supplierId || !localIds.has(r.supplierId));
  }, [appRows, subiektRows]);

  const subiektQueryActive = debouncedForSubiekt.length >= SUBIEKT_MIN_QUERY_LEN;
  const visibleSubiektRows = useMemo(
    () => (subiektQueryActive ? shownSubiektRows : []),
    [shownSubiektRows, subiektQueryActive]
  );
  const visibleFeedback = subiektQueryActive ? feedback : null;
  const visibleSubiektWarning = subiektQueryActive ? subiektWarning : null;
  const visibleStatus = subiektQueryActive
    ? isPending
      ? "loading"
      : status
    : "idle";

  const showDropdown =
    open &&
    (allowEmpty ||
      appRows.length > 0 ||
      visibleSubiektRows.length > 0 ||
      visibleStatus === "loading");

  const keyboardOptions = useMemo(() => {
    const rows: { key: string; supplierId: string; label: string }[] = [];
    if (allowEmpty && !query.trim()) {
      rows.push({ key: "__empty__", supplierId: "", label: emptyLabel });
    }
    for (const s of appRows) {
      if (s.supplierId) {
        rows.push({ key: s.supplierId, supplierId: s.supplierId, label: s.label });
      }
    }
    for (const s of visibleSubiektRows) {
      if (s.supplierId) {
        rows.push({
          key: s.supplierId,
          supplierId: s.supplierId,
          label: s.label,
        });
      }
    }
    return rows;
  }, [allowEmpty, appRows, emptyLabel, query, visibleSubiektRows]);

  const keyboardOptionsKey = keyboardOptions.map((row) => row.key).join("\0");
  const [appliedKeyboardOptionsKey, setAppliedKeyboardOptionsKey] =
    useState(keyboardOptionsKey);
  if (keyboardOptionsKey !== appliedKeyboardOptionsKey) {
    setAppliedKeyboardOptionsKey(keyboardOptionsKey);
    setHighlightedIndex(0);
  }

  const listVisible = showDropdown && keyboardOptions.length > 0;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (portalled && target instanceof Element) {
        const listbox = document.getElementById(listboxId);
        if (listbox?.contains(target)) return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [listboxId, portalled]);

  useEffect(() => {
    if (!subiektQueryActive) return;

    const requestId = ++subiektRequestId.current;

    startTransition(async () => {
      const res = await actionSubiektSuggestSuppliers(debouncedForSubiekt);
      if (requestId !== subiektRequestId.current) return;

      if (!res.ok) {
        setSubiektRows([]);
        setFeedback(res.feedback);
        setStatus("error");
        return;
      }
      setSubiektRows(res.suggestions);
      setFeedback(res.feedback ?? null);
      setSubiektWarning(res.subiektWarning ?? null);
      setStatus("idle");
    });
  }, [debouncedForSubiekt, subiektQueryActive]);

  const displayValue = open ? query : (selected?.name ?? "");

  const clear = useCallback(() => {
    onChange("");
    setQuery("");
    setOpen(false);
    setFeedback(null);
    setSubiektRows([]);
    setHighlightedIndex(0);
  }, [onChange]);

  const select = useCallback(
    (id: string, name: string) => {
      onChange(id);
      setQuery(name);
      setOpen(false);
      setFeedback(null);
      setSubiektWarning(null);
      setSubiektRows([]);
      setHighlightedIndex(0);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      const hasList = keyboardOptions.length > 0;

      if (e.key === "ArrowDown" && hasList) {
        e.preventDefault();
        if (!open) {
          setOpen(true);
          setHighlightedIndex(0);
          return;
        }
        setHighlightedIndex((i) => Math.min(i + 1, keyboardOptions.length - 1));
        return;
      }

      if (e.key === "ArrowUp" && hasList && open) {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        return;
      }

      if (e.key === "Enter") {
        if (listVisible) {
          e.preventDefault();
          e.stopPropagation();
          const chosen = keyboardOptions[highlightedIndex];
          if (!chosen) return;
          if (chosen.supplierId) select(chosen.supplierId, chosen.label);
          else clear();
        }
        return;
      }

      if (e.key === "Escape" && open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setHighlightedIndex(0);
      }
    },
    [clear, highlightedIndex, keyboardOptions, listVisible, open, select]
  );

  const optionIndexForKey = useCallback(
    (key: string) => keyboardOptions.findIndex((row) => row.key === key),
    [keyboardOptions]
  );

  const showInfoFeedback =
    visibleFeedback &&
    visibleFeedback.tone === "info" &&
    appRows.length === 0 &&
    visibleSubiektRows.length === 0 &&
    subiektQueryActive;

  const pickerFeedbacks = useMemo(() => {
    if (showInlineFeedback) return [] as SubiektFeedback[];
    return [
      visibleSubiektWarning,
      visibleStatus === "error" ? visibleFeedback : null,
      showInfoFeedback ? visibleFeedback : null,
    ].filter(Boolean) as SubiektFeedback[];
  }, [
    showInlineFeedback,
    visibleSubiektWarning,
    visibleStatus,
    visibleFeedback,
    showInfoFeedback,
  ]);

  useEffect(() => {
    onSubiektFeedbackChange?.(pickerFeedbacks);
  }, [pickerFeedbacks, onSubiektFeedbackChange]);

  return (
    <div ref={containerRef} className="relative space-y-2">
      <div
        ref={anchorRef}
        className={cn(
          "relative rounded-md transition-[box-shadow]",
          showDropdown && "z-30 ring-2 ring-indigo-400/80 ring-offset-2"
        )}
      >
        <Input
          disabled={disabled}
          placeholder={placeholder}
          value={displayValue}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? listboxId : undefined}
          aria-activedescendant={
            listVisible ? `${listboxId}-opt-${highlightedIndex}` : undefined
          }
          onKeyDown={handleKeyDown}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setOpen(true);
            if (value && v !== selected?.name) onChange("");
          }}
          onFocus={() => {
            setOpen(true);
            setQuery(selected?.name ?? query);
          }}
        />
        {visibleStatus === "loading" && subiektQueryActive ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner size="sm" />
          </span>
        ) : null}
      </div>

      {selected && !open ? (
        <p className="text-xs text-indigo-700">
          Wybrano: <span className="font-medium">{selected.name}</span>
          {allowEmpty ? (
            <button
              type="button"
              className="ml-2 text-slate-500 underline hover:text-slate-800"
              onClick={clear}
              disabled={disabled}
            >
              wyczyść
            </button>
          ) : null}
        </p>
      ) : null}

      <TypeaheadDropdown
        listboxId={listboxId}
        open={showDropdown}
        size={dropdownSize}
        portalled={portalled}
        anchorRef={portalled ? anchorRef : undefined}
        footer={listVisible ? TYPEAHEAD_KEYBOARD_HINT : undefined}
        emptyMessage={
          visibleStatus === "loading" && appRows.length === 0
            ? "Szukam w Subiekcie…"
            : query.trim() && appRows.length === 0 && visibleSubiektRows.length === 0
              ? "Brak wyników w systemie"
              : undefined
        }
      >
        {allowEmpty && !query.trim() ? (
          <TypeaheadOption
            optionId={`${listboxId}-opt-${optionIndexForKey("__empty__")}`}
            title={emptyLabel}
            subtitle="Dział dostaw może uzupełnić później"
            size={dropdownSize}
            highlighted={highlightedIndex === optionIndexForKey("__empty__")}
            onHighlight={() => setHighlightedIndex(optionIndexForKey("__empty__"))}
            onSelect={clear}
          />
        ) : null}

        {appRows.length > 0 ? (
          <>
            <TypeaheadSectionLabel>W systemie</TypeaheadSectionLabel>
            {appRows.map((s) => {
              const supplierId = s.supplierId;
              if (!supplierId) return null;
              return (
                <TypeaheadOption
                  key={supplierId}
                  optionId={`${listboxId}-opt-${optionIndexForKey(supplierId)}`}
                  title={s.label}
                  subtitle={s.detail}
                  size={dropdownSize}
                  highlighted={highlightedIndex === optionIndexForKey(supplierId)}
                  onHighlight={() => setHighlightedIndex(optionIndexForKey(supplierId))}
                  onSelect={() => select(supplierId, s.label)}
                />
              );
            })}
          </>
        ) : null}

        {visibleSubiektRows.length > 0 ? (
          <>
            <TypeaheadSectionLabel>Subiekt — brak w bazie</TypeaheadSectionLabel>
            {visibleSubiektRows.map((s, i) => {
              const supplierId = s.supplierId;
              if (!supplierId) {
                return (
                  <TypeaheadInfoRow
                    key={`unmapped-${i}`}
                    title={s.label}
                    subtitle={
                      s.detail ??
                      "Brak w bazie aplikacji — dodaj dostawcę w katalogu lub wybierz z listy „W systemie”."
                    }
                    size={dropdownSize}
                  />
                );
              }
              return (
                <TypeaheadOption
                  key={supplierId}
                  optionId={`${listboxId}-opt-${optionIndexForKey(supplierId)}`}
                  title={s.label}
                  subtitle={s.detail}
                  size={dropdownSize}
                  highlighted={highlightedIndex === optionIndexForKey(supplierId)}
                  onHighlight={() => setHighlightedIndex(optionIndexForKey(supplierId))}
                  onSelect={() => select(supplierId, s.label)}
                />
              );
            })}
          </>
        ) : null}
      </TypeaheadDropdown>

      {showInlineFeedback && visibleSubiektWarning ? (
        <SubiektFeedbackAlert feedback={visibleSubiektWarning} compact />
      ) : null}
      {showInlineFeedback && visibleStatus === "error" && visibleFeedback ? (
        <SubiektFeedbackAlert feedback={visibleFeedback} compact />
      ) : null}
      {showInlineFeedback && showInfoFeedback && visibleFeedback ? (
        <SubiektFeedbackAlert feedback={visibleFeedback} compact />
      ) : null}
    </div>
  );
}
