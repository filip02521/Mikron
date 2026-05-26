"use client";

import { useState, useTransition } from "react";
import {
  actionSubiektLookupSupplier,
  actionSetSupplierSubiektKhId,
} from "@/app/actions/subiekt";
import { SubiektFeedbackAlert } from "@/components/subiekt/SubiektFeedbackAlert";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { formatSubiektKontrahentLabel } from "@/lib/subiekt/match-supplier";
import type { SubiektKontrahent } from "@/lib/subiekt/types";

export function SupplierSubiektLinkField({
  supplierId,
  supplierName,
  subiektKhId,
  onLinked,
}: {
  supplierId: string;
  supplierName: string;
  subiektKhId: number | null;
  onLinked?: (khId: number | null) => void;
}) {
  const [query, setQuery] = useState(supplierName);
  const [results, setResults] = useState<SubiektKontrahent[]>([]);
  const [feedback, setFeedback] = useState<SubiektFeedback | null>(null);
  const [linkedLabel, setLinkedLabel] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const search = () => {
    const q = query.trim();
    if (!q) return;
    setFeedback(null);
    start(async () => {
      const res = await actionSubiektLookupSupplier(q);
      if (!res.ok) {
        setResults([]);
        setFeedback(res.feedback);
        return;
      }
      setResults(res.items);
      setFeedback(res.feedback ?? null);
    });
  };

  const link = (k: SubiektKontrahent) => {
    start(async () => {
      const res = await actionSetSupplierSubiektKhId(supplierId, k.kh_Id);
      if (!res.ok) {
        setFeedback(res.feedback);
        return;
      }
      setLinkedLabel(formatSubiektKontrahentLabel(k));
      setResults([]);
      setFeedback(null);
      onLinked?.(k.kh_Id);
    });
  };

  const clear = () => {
    start(async () => {
      const res = await actionSetSupplierSubiektKhId(supplierId, null);
      if (!res.ok) {
        setFeedback(res.feedback);
        return;
      }
      setLinkedLabel(null);
      onLinked?.(null);
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Powiązanie z Subiektem
      </p>
      {subiektKhId != null ? (
        <p className="text-sm text-indigo-800">
          Powiązano: <span className="font-medium">kh_Id {subiektKhId}</span>
          {linkedLabel ? ` · ${linkedLabel}` : null}
        </p>
      ) : (
        <p className="text-xs text-slate-600">
          Bez powiązania auto-dostawca z ZD może nie trafić — wyszukaj kontrahenta w Subiekcie
          i zapisz powiązanie.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Field label="Szukaj w Subiekcie" className="min-w-[12rem] flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nazwa lub symbol kontrahenta…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                search();
              }
            }}
          />
        </Field>
        <Button type="button" variant="secondary" size="sm" className="self-end" onClick={search}>
          Szukaj
        </Button>
        {subiektKhId != null ? (
          <Button type="button" variant="ghost" size="sm" className="self-end" onClick={clear}>
            Usuń powiązanie
          </Button>
        ) : null}
      </div>

      {pending ? (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Spinner size="sm" /> Łączenie…
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1">
          {results.map((k) => (
            <li key={k.kh_Id}>
              <button
                type="button"
                className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-indigo-50"
                onClick={() => link(k)}
              >
                <span className="font-medium">{formatSubiektKontrahentLabel(k)}</span>
                <span className="ml-2 text-xs text-slate-400">id {k.kh_Id}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {feedback ? <SubiektFeedbackAlert feedback={feedback} compact /> : null}
    </div>
  );
}
