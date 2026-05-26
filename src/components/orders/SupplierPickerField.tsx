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
import type { SubiektFeedback } from "@/lib/subiekt/feedback";

export type SupplierPickerOption = { id: string; name: string };

export function SupplierPickerField({
  suppliers,
  value,
  onChange,
  disabled,
  placeholder = "Szukaj dostawcy…",
  allowEmpty = true,
  emptyLabel = "Wybierz później / nie wiem",
}: {
  suppliers: SupplierPickerOption[];
  value: string;
  onChange: (supplierId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<SubiektSupplierSuggestion[]>([]);
  const [feedback, setFeedback] = useState<SubiektFeedback | null>(null);
  const [subiektWarning, setSubiektWarning] = useState<SubiektFeedback | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [, startTransition] = useTransition();
  const debounced = useDebouncedValue(query.trim(), 300);

  const selected = useMemo(
    () => suppliers.find((s) => s.id === value),
    [suppliers, value]
  );

  const sorted = useMemo(
    () => [...suppliers].sort((a, b) => a.name.localeCompare(b.name, "pl")),
    [suppliers]
  );

  const localOnly = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted.slice(0, 12);
    return sorted.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 12);
  }, [query, sorted]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (debounced.length < 2) {
      setRemote([]);
      setFeedback(null);
      setSubiektWarning(null);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    setFeedback(null);
    setSubiektWarning(null);
    startTransition(async () => {
      const res = await actionSubiektSuggestSuppliers(
        debounced,
        suppliers.map((s) => ({ id: s.id, name: s.name }))
      );
      if (!res.ok) {
        setRemote([]);
        setFeedback(res.feedback);
        setStatus("error");
        return;
      }
      setRemote(res.suggestions);
      setFeedback(res.feedback ?? null);
      setSubiektWarning(res.subiektWarning ?? null);
      setStatus("idle");
    });
  }, [debounced, suppliers]);

  const displayValue = open ? query : (selected?.name ?? "");

  const select = (id: string, name: string) => {
    onChange(id);
    setQuery(name);
    setOpen(false);
    setFeedback(null);
    setSubiektWarning(null);
  };

  const clear = () => {
    onChange("");
    setQuery("");
    setOpen(false);
    setFeedback(null);
  };

  const useRemote = debounced.length >= 2;
  const appRows: SubiektSupplierSuggestion[] = useRemote
    ? remote.filter((s) => s.supplierId)
    : localOnly.map((s) => ({
        supplierId: s.id,
        label: s.name,
        source: "app" as const,
      }));
  const subiektRows = useRemote ? remote.filter((s) => !s.supplierId) : [];

  const showDropdown =
    open &&
    (allowEmpty ||
      appRows.length > 0 ||
      subiektRows.length > 0 ||
      status === "loading");

  const showInfoFeedback =
    feedback && feedback.tone === "info" && appRows.length === 0 && subiektRows.length === 0;

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
        {status === "loading" ? (
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
        emptyMessage={status === "loading" ? "Szukam dostawców…" : undefined}
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
                  onSelect={() => select(s.supplierId!, s.label)}
                />
              ) : null
            )}
          </>
        ) : null}

        {subiektRows.length > 0 ? (
          <>
            <TypeaheadSectionLabel>Subiekt — brak w bazie</TypeaheadSectionLabel>
            {subiektRows.map((s, i) => (
              <TypeaheadOption
                key={`unmapped-${i}`}
                title={s.label}
                subtitle={s.detail}
                onSelect={() => setOpen(false)}
              />
            ))}
          </>
        ) : null}
      </TypeaheadDropdown>

      {subiektWarning ? <SubiektFeedbackAlert feedback={subiektWarning} compact /> : null}
      {status === "error" && feedback ? (
        <SubiektFeedbackAlert feedback={feedback} compact />
      ) : null}
      {showInfoFeedback && feedback ? (
        <SubiektFeedbackAlert feedback={feedback} compact />
      ) : null}
    </div>
  );
}
