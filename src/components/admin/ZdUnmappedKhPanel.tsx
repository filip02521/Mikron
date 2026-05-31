"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { actionAddSupplierSubiektKhAlias } from "@/app/actions/subiekt";
import type { ZdUnmappedKhReport } from "@/lib/subiekt/zd-unmapped-kh";
import { kontrahentDisplayName } from "@/lib/subiekt/resolve-kontrahent-labels";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

function reasonLabel(
  row: ZdUnmappedKhReport["rows"][number]
): { text: string; tone: "amber" | "red" } {
  const who = kontrahentDisplayName(row.kontrahentLabel, row.subiektKhId);
  if (row.reason === "supplier_exists_reindex") {
    return {
      tone: "amber",
      text: `„${who}” jest już powiązany z dostawcą „${row.supplierHint}” (główne lub dodatkowe) — uruchom ponowne indeksowanie ZD`,
    };
  }
  return {
    tone: "red",
    text: `„${who}” nie ma dostawcy w aplikacji — dodaj powiązanie w Admin → Dostawcy`,
  };
}

export function ZdUnmappedKhPanel({
  report,
  loading,
  onRefresh,
}: {
  report: ZdUnmappedKhReport | null;
  loading?: boolean;
  onRefresh: () => void;
}) {
  const rows = report?.rows ?? [];
  const [pending, start] = useTransition();
  const [linkingKh, setLinkingKh] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "err" } | null>(null);

  const suggestionCount = rows.filter((r) => r.suggestion?.action === "add_alias").length;

  const acceptSuggestion = (row: ZdUnmappedKhReport["rows"][number]) => {
    const s = row.suggestion;
    if (!s || s.action !== "add_alias") return;
    setLinkingKh(row.subiektKhId);
    setMessage(null);
    start(async () => {
      const res = await actionAddSupplierSubiektKhAlias(s.supplierId, row.subiektKhId, {
        kontrahentLabel: row.kontrahentLabel,
        note: `ZD (${row.zdCount} dok.) · propozycja ${s.score}%`,
      });
      setLinkingKh(null);
      if (!res.ok) {
        setMessage({ text: res.feedback.message, tone: "err" });
        return;
      }
      setMessage({
        text: `Dodano dodatkowy kontrahent u „${s.supplierName}”. Uruchom ponowne indeksowanie ZD.`,
        tone: "ok",
      });
      onRefresh();
    });
  };

  return (
    <div className="mt-4 rounded-md border border-amber-200/80 bg-amber-50/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Kontrahenci z ZD bez przypisanego dostawcy
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
            Nazwy z Subiekta. System może zaproponować dostawcę po podobnej nazwie (np. zmiana sp.
            k. → sp. z o.o.). Po zaakceptowaniu uruchom ponowne indeksowanie ZD. Powiązania ręczne:{" "}
            <Link href="/admin/dostawcy" className="font-medium text-indigo-700 underline">
              Dostawcy
            </Link>
            .
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onRefresh} disabled={loading || pending}>
          Odśwież listę
        </Button>
      </div>

      {message ? (
        <p
          className={cn(
            "mt-2 text-xs",
            message.tone === "ok" ? "text-emerald-800" : "text-red-700"
          )}
        >
          {message.text}
        </p>
      ) : null}

      {report == null ? (
        <p className="mt-3 text-xs text-slate-600">
          Kliknij <span className="font-medium">Odśwież listę</span> po zakończeniu (lub w trakcie)
          indeksowania ZD.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-xs text-emerald-800">
          Brak — każdy zweryfikowany kontrahent z ZD ma przypisanego dostawcę (
          {report.totalUnmappedZd === 0 ? "0 nieprzypisanych ZD" : "stan aktualny"}).
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-slate-600">
            <span className="font-semibold tabular-nums">{rows.length}</span>{" "}
            {rows.length === 1 ? "kontrahent" : "kontrahentów"} ·{" "}
            <span className="font-semibold tabular-nums">{report.totalUnmappedZd}</span>{" "}
            {report.totalUnmappedZd === 1 ? "dokument ZD" : "dokumentów ZD"}
            {suggestionCount > 0 ? (
              <>
                {" "}
                · <span className="font-semibold text-indigo-800">{suggestionCount}</span>{" "}
                {suggestionCount === 1 ? "propozycja" : "propozycje"} połączenia
              </>
            ) : null}
            {report.indexedAt
              ? ` · indeks ${report.indexedAt.slice(0, 19).replace("T", " ")}`
              : ""}
          </p>
          <div className="mt-3 max-h-80 overflow-auto rounded-md border border-slate-200 bg-white">
            <table className="w-full min-w-[44rem] text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Kontrahent (Subiekt)</th>
                  <th className="px-3 py-2">ZD</th>
                  <th className="px-3 py-2">Propozycja dostawcy</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const hint = reasonLabel(row);
                  const display = kontrahentDisplayName(row.kontrahentLabel, row.subiektKhId);
                  const s = row.suggestion;
                  return (
                    <tr key={row.subiektKhId} className="align-top text-slate-800">
                      <td className="px-3 py-2">
                        <span className="font-medium leading-snug">{display}</span>
                        <span className="mt-0.5 block font-mono text-[10px] text-slate-400">
                          id {row.subiektKhId}
                        </span>
                        {row.sampleDocNumbers.length > 0 ? (
                          <span
                            className="mt-1 block text-[10px] text-slate-500 line-clamp-2"
                            title={row.sampleDocNumbers.join(", ")}
                          >
                            np. {row.sampleDocNumbers.slice(0, 2).join(", ")}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{row.zdCount}</td>
                      <td className="px-3 py-2">
                        {s ? (
                          <div className="space-y-1.5">
                            <div>
                              <span className="font-medium text-indigo-900">{s.supplierName}</span>
                              <span
                                className={cn(
                                  "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                                  s.score >= 80
                                    ? "bg-emerald-100 text-emerald-900"
                                    : "bg-indigo-100 text-indigo-900"
                                )}
                              >
                                {s.score}%
                              </span>
                              <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
                                {s.reason}
                              </p>
                            </div>
                            {s.action === "add_alias" ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={pending}
                                onClick={() => acceptSuggestion(row)}
                              >
                                {linkingKh === row.subiektKhId
                                  ? "Zapisuję…"
                                  : "Dodaj jako dodatkowy kontrahent"}
                              </Button>
                            ) : (
                              <p className="text-[11px] text-amber-900">
                                Powiązanie jest w kartotece — wystarczy reindeks ZD (przycisk wyżej).
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500">
                            Brak pewnej propozycji — sprawdź ręcznie w Dostawcy
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-block rounded-md px-2 py-1 text-[11px] leading-snug",
                            hint.tone === "amber"
                              ? "bg-amber-100 text-amber-950"
                              : "bg-red-50 text-red-900"
                          )}
                        >
                          {hint.text}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
