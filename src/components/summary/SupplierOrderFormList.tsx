"use client";

import { useState, useTransition } from "react";
import { actionListSupplierFormZds, type SupplierFormZd } from "@/app/actions/supplier-forms";
import { IconDownload } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { polishPluralWord } from "@/lib/email/polish-plural";

function shortDate(key: string | null): string {
  if (!key) return "";
  const [y, m, d] = key.split("-");
  return d && m && y ? `${d}.${m}.${y}` : key;
}

/** Ostatnie ZD dostawcy → formularz zamówienia (PDF) do pobrania. */
export function SupplierOrderFormList({ supplierId }: { supplierId: string }) {
  const [documents, setDocuments] = useState<SupplierFormZd[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const load = () =>
    startLoading(async () => {
      setError(null);
      const res = await actionListSupplierFormZds(supplierId);
      if (res.ok) setDocuments(res.documents);
      else setError(res.message);
    });

  if (documents == null) {
    return (
      <div className="space-y-2">
        <Button variant="secondary" size="sm" onClick={load} disabled={loading} aria-busy={loading}>
          {loading ? "Wczytuję ZD…" : "Wybierz ZD i pobierz formularz"}
        </Button>
        {error ? <p className="text-xs text-red-700">{error}</p> : null}
      </div>
    );
  }

  if (documents.length === 0) {
    return <p className="text-xs text-slate-500">Brak ZD tego dostawcy w ostatnim czasie.</p>;
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-md border border-slate-200/70">
      {documents.map((d) => (
        <li key={d.dokId} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900">
              {d.dokNr}
              <span className="ml-1.5 text-xs font-normal text-slate-500">{shortDate(d.dataWyst)}</span>
            </p>
            {d.error ? (
              <p className="text-xs text-red-700">{d.error}</p>
            ) : (
              <p className="text-xs text-slate-500">
                {d.mappedCount} {polishPluralWord(d.mappedCount, "pozycja", "pozycje", "pozycji")} w formularzu
              </p>
            )}
            {d.unmapped.length > 0 ? (
              <p className="mt-0.5 text-xs text-amber-800">
                Poza formularzem (wpisane w uwagi — sprawdź przed wysłaniem):{" "}
                {d.unmapped.map((l) => `${l.name} × ${l.qty}`).join(", ")}
              </p>
            ) : null}
          </div>
          {!d.error ? (
            <a
              href={`/api/operations/supplier-forms/zd/${d.dokId}?supplierId=${encodeURIComponent(supplierId)}`}
              download
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
              )}
            >
              <IconDownload size={14} className="shrink-0" />
              Pobierz PDF
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
