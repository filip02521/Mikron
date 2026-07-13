"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  actionSubiektLookupSupplier,
  actionSetSupplierSubiektKhId,
  actionListSupplierSubiektKhAliases,
  actionAddSupplierSubiektKhAlias,
  actionRemoveSupplierSubiektKhAlias,
  actionResolveKontrahentLabels,
} from "@/app/actions/subiekt";
import { kontrahentDisplayName } from "@/lib/subiekt/resolve-kontrahent-labels";
import { SubiektFeedbackAlert } from "@/components/subiekt/SubiektFeedbackAlert";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { formatSubiektKontrahentLabel } from "@/lib/subiekt/match-supplier";
import type { SubiektKontrahent } from "@/lib/subiekt/types";
import type { SupplierSubiektKhAliasRow } from "@/lib/data/supplier-subiekt-kh";

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
  const [primaryLabel, setPrimaryLabel] = useState<string | null>(null);
  const [resolvedPrimaryKhId, setResolvedPrimaryKhId] = useState<number | null>(null);
  const [aliases, setAliases] = useState<SupplierSubiektKhAliasRow[]>([]);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (subiektKhId == null || linkedLabel) return;
    if (resolvedPrimaryKhId === subiektKhId) return;
    start(async () => {
      try {
        const labels = await actionResolveKontrahentLabels([subiektKhId]);
        setPrimaryLabel(labels[subiektKhId] ?? null);
        setResolvedPrimaryKhId(subiektKhId);
      } catch {
        setPrimaryLabel(null);
        setResolvedPrimaryKhId(subiektKhId);
      }
    });
  }, [subiektKhId, linkedLabel, resolvedPrimaryKhId]);

  if (subiektKhId == null && (primaryLabel !== null || resolvedPrimaryKhId !== null)) {
    setPrimaryLabel(null);
    setResolvedPrimaryKhId(null);
  }

  const reloadAliases = useCallback(() => {
    start(async () => {
      try {
        const rows = await actionListSupplierSubiektKhAliases(supplierId);
        const missingKh = rows.filter((r) => !r.kontrahentLabel).map((r) => r.subiektKhId);
        if (missingKh.length === 0) {
          setAliases(rows);
          return;
        }
        const labels = await actionResolveKontrahentLabels(missingKh);
        setAliases(
          rows.map((r) => ({
            ...r,
            kontrahentLabel: r.kontrahentLabel ?? labels[r.subiektKhId] ?? null,
          }))
        );
      } catch {
        setAliases([]);
      }
    });
  }, [supplierId]);

  useEffect(() => {
    reloadAliases();
  }, [reloadAliases, subiektKhId]);

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

  const setPrimary = (k: SubiektKontrahent) => {
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
      reloadAliases();
    });
  };

  const addAlias = (k: SubiektKontrahent) => {
    start(async () => {
      const res = await actionAddSupplierSubiektKhAlias(supplierId, k.kh_Id, {
        kontrahentLabel: formatSubiektKontrahentLabel(k),
      });
      if (!res.ok) {
        setFeedback(res.feedback);
        return;
      }
      setResults([]);
      setFeedback(null);
      reloadAliases();
    });
  };

  const removeAlias = (khId: number) => {
    start(async () => {
      const res = await actionRemoveSupplierSubiektKhAlias(supplierId, khId);
      if (!res.ok) {
        setFeedback(res.feedback);
        return;
      }
      reloadAliases();
    });
  };

  const clearPrimary = () => {
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
    <div className="rounded-lg border border-slate-200/70 bg-slate-50/50 p-3.5 space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Powiązanie z Subiektem
      </p>
      {subiektKhId != null ? (
        <div className="flex items-center gap-2 rounded-lg bg-indigo-50/60 px-3 py-2 ring-1 ring-inset ring-indigo-100/40">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-indigo-700">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.07 0l1.41-1.41a5 5 0 00-7.07-7.07L10 5.93" /><path d="M14 11a5 5 0 00-7.07 0L5.51 12.41a5 5 0 007.07 7.07L14 18.07" /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-indigo-900">
              {kontrahentDisplayName(linkedLabel ?? primaryLabel, subiektKhId)}
            </p>
            <p className="text-[11px] text-indigo-600/80">
              id {subiektKhId}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-slate-500">
          Wyszukaj kontrahenta po nazwie w Subiekcie i ustaw jako głównego albo dodaj dodatkowego
          (np. po zmianie firmy) — indeks ZD dopasuje dokumenty z każdej z tych kart do tego
          dostawcy.
        </p>
      )}

      {aliases.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Dodatkowi kontrahenci
          </p>
          <ul className="space-y-1">
            {aliases.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/70 bg-white px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium text-slate-900">
                    {kontrahentDisplayName(a.kontrahentLabel, a.subiektKhId)}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] text-slate-400">
                    id {a.subiektKhId}
                  </span>
                  {a.note ? (
                    <span className="mt-0.5 block text-xs text-slate-600">{a.note}</span>
                  ) : null}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAlias(a.subiektKhId)}
                  disabled={pending}
                >
                  Usuń
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
          <Button type="button" variant="ghost" size="sm" className="self-end" onClick={clearPrimary}>
            Usuń główne
          </Button>
        ) : null}
      </div>

      {pending ? (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Spinner size="sm" /> Łączenie…
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200/70 bg-white p-1.5">
          {results.map((k) => {
            const isPrimary = subiektKhId === k.kh_Id;
            const isAlias = aliases.some((a) => a.subiektKhId === k.kh_Id);
            return (
              <li key={k.kh_Id} className="rounded-lg border border-transparent p-1.5 transition hover:border-slate-200 hover:bg-slate-50/50">
                <div className="px-1 py-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900">{formatSubiektKontrahentLabel(k)}</span>
                    <span className="text-xs text-slate-400">id {k.kh_Id}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                    {k.adr_NIP ? <span>NIP: {k.adr_NIP}</span> : null}
                    {k.adr_Miejscowosc ? <span>{k.adr_Miejscowosc}</span> : null}
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5 px-1">
                  {!isPrimary ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setPrimary(k)}
                      disabled={pending}
                    >
                      Ustaw jako główne
                    </Button>
                  ) : (
                    <span className="self-center px-2 text-[11px] font-medium text-indigo-700">Główne</span>
                  )}
                  {!isAlias && !isPrimary ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => addAlias(k)}
                      disabled={pending}
                    >
                      Dodaj dodatkowy
                    </Button>
                  ) : isAlias ? (
                    <span className="self-center px-2 text-[11px] text-slate-400">Już dodatkowy</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {feedback ? <SubiektFeedbackAlert feedback={feedback} compact /> : null}
    </div>
  );
}
