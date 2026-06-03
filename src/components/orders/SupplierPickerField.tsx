"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  actionSubiektSuggestSuppliers,
  type SubiektSupplierSuggestion,
} from "@/app/actions/subiekt";
import { SubiektFeedbackAlert } from "@/components/subiekt/SubiektFeedbackAlert";
import { Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import {
  TypeaheadDropdown,
  TypeaheadOption,
  TypeaheadSectionLabel,
} from "@/components/ui/TypeaheadDropdown";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { filterSuppliersByName } from "@/lib/orders/filter-suppliers";
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
}) {
  const ref = useRef<HTMLDivElement>(null);
  const subiektRequestId = useRef(0);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [subiektRows, setSubiektRows] = useState<SubiektSupplierSuggestion[]>([]);
  const [feedback, setFeedback] = useState<SubiektFeedback | null>(null);
  const [subiektWarning, setSubiektWarning] = useState<SubiektFeedback | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [, startTransition] = useTransition();
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

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (debouncedForSubiekt.length < SUBIEKT_MIN_QUERY_LEN) {
      setSubiektRows([]);
      setFeedback(null);
      setSubiektWarning(null);
      setStatus("idle");
      return;
    }

    const requestId = ++subiektRequestId.current;
    setStatus("loading");
    setFeedback(null);
    setSubiektWarning(null);

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
  }, [debouncedForSubiekt]);

  const displayValue = open ? query : (selected?.name ?? "");

  const select = (id: string, name: string) => {
    onChange(id);
    setQuery(name);
    setOpen(false);
    setFeedback(null);
    setSubiektWarning(null);
    setSubiektRows([]);
  };

  const clear = () => {
    onChange("");
    setQuery("");
    setOpen(false);
    setFeedback(null);
    setSubiektRows([]);
  };

  const showDropdown =
    open &&
    (allowEmpty ||
      appRows.length > 0 ||
      shownSubiektRows.length > 0 ||
      status === "loading");

  const showInfoFeedback =
    feedback &&
    feedback.tone === "info" &&
    appRows.length === 0 &&
    shownSubiektRows.length === 0 &&
    debouncedForSubiekt.length >= SUBIEKT_MIN_QUERY_LEN;

  const pickerFeedbacks = useMemo(() => {
    if (showInlineFeedback) return [] as SubiektFeedback[];
    return [
      subiektWarning,
      status === "error" ? feedback : null,
      showInfoFeedback ? feedback : null,
    ].filter(Boolean) as SubiektFeedback[];
  }, [showInlineFeedback, subiektWarning, status, feedback, showInfoFeedback]);

  useEffect(() => {
    onSubiektFeedbackChange?.(pickerFeedbacks);
  }, [pickerFeedbacks, onSubiektFeedbackChange]);

  return (
    <div ref={ref} className="relative space-y-2">
      <div className="relative">
        <Input
          disabled={disabled}
          placeholder={placeholder}
          value={displayValue}
          autoComplete="off"
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
        {status === "loading" && debouncedForSubiekt.length >= SUBIEKT_MIN_QUERY_LEN ? (
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
        open={showDropdown}
        size={dropdownSize}
        emptyMessage={
          status === "loading" && appRows.length === 0
            ? "Szukam w Subiekcie…"
            : query.trim() && appRows.length === 0 && shownSubiektRows.length === 0
              ? "Brak wyników w systemie"
              : undefined
        }
      >
        {allowEmpty && !query.trim() ? (
          <TypeaheadOption
            title={emptyLabel}
            subtitle="Dział dostaw może uzupełnić później"
            onSelect={clear}
          />
        ) : null}

        {appRows.length > 0 ? (
          <>
            <TypeaheadSectionLabel>W systemie</TypeaheadSectionLabel>
            {appRows.map((s) =>
              s.supplierId ? (
                <TypeaheadOption
                  key={s.supplierId}
                  title={s.label}
                  subtitle={s.detail}
                  size={dropdownSize}
                  onSelect={() => select(s.supplierId!, s.label)}
                />
              ) : null
            )}
          </>
        ) : null}

        {shownSubiektRows.length > 0 ? (
          <>
            <TypeaheadSectionLabel>Subiekt — brak w bazie</TypeaheadSectionLabel>
            {shownSubiektRows.map((s, i) => (
              <TypeaheadOption
                key={s.supplierId ?? `unmapped-${i}`}
                title={s.label}
                subtitle={s.detail}
                size={dropdownSize}
                onSelect={() => {
                  if (s.supplierId) select(s.supplierId, s.label);
                  else setOpen(false);
                }}
              />
            ))}
          </>
        ) : null}
      </TypeaheadDropdown>

      {showInlineFeedback && subiektWarning ? (
        <SubiektFeedbackAlert feedback={subiektWarning} compact />
      ) : null}
      {showInlineFeedback && status === "error" && feedback ? (
        <SubiektFeedbackAlert feedback={feedback} compact />
      ) : null}
      {showInlineFeedback && showInfoFeedback && feedback ? (
        <SubiektFeedbackAlert feedback={feedback} compact />
      ) : null}
    </div>
  );
}
