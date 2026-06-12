"use client";

import { useMemo, useState, useTransition } from "react";
import { actionUpdateSalesBugReport } from "@/app/actions/sales-bug-report";
import type { SalesBugReport, SalesBugReportStatus } from "@/types/database";
import { cn } from "@/lib/cn";
import { formatWarsawDateTime } from "@/lib/time/warsaw";

const STATUS_LABEL: Record<SalesBugReportStatus, string> = {
  open: "NOWE",
  triaged: "W TOKU",
  closed: "ZAMKNIĘTE",
};

const STATUS_STAMP: Record<SalesBugReportStatus, string> = {
  open: "bg-red-200 text-red-950 rotate-[-2deg]",
  triaged: "bg-amber-200 text-amber-950 rotate-[1deg]",
  closed: "bg-lime-200 text-lime-950 rotate-[-1deg]",
};

function formatWhen(iso: string) {
  return formatWarsawDateTime(iso);
}

function ReportNote({
  report,
  onUpdated,
}: {
  report: SalesBugReport;
  onUpdated: (next: SalesBugReport) => void;
}) {
  const [status, setStatus] = useState(report.status);
  const [adminNote, setAdminNote] = useState(report.admin_note ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    start(async () => {
      const result = await actionUpdateSalesBugReport({
        id: report.id,
        status,
        adminNote,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onUpdated(result.report);
    });
  }

  return (
    <article
      className={cn(
        "relative border-2 border-dashed border-neutral-800 bg-[#fff9bf] p-4 shadow-[4px_4px_0_#1f2937]",
        "font-mono text-[13px] leading-relaxed text-neutral-900",
        report.status === "closed" && "opacity-75"
      )}
      style={{
        transform: `rotate(${(report.id.charCodeAt(0) % 5) - 2}deg)`,
      }}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-dashed border-neutral-600 pb-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-600">
            od: {report.reporter_name}
          </p>
          <p className="text-[11px] text-neutral-700">
            {report.reporter_email ?? "—"} · {formatWhen(report.created_at)}
          </p>
        </div>
        <span
          className={cn(
            "inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            STATUS_STAMP[report.status]
          )}
        >
          {STATUS_LABEL[report.status]}
        </span>
      </div>

      <p className="mb-3 whitespace-pre-wrap">{report.message}</p>

      <dl className="mb-3 space-y-1 text-[11px] text-neutral-700">
        <div>
          <dt className="inline font-bold">strona:</dt>{" "}
          <dd className="inline break-all">{report.page_path}</dd>
        </div>
        {report.user_agent ? (
          <div>
            <dt className="inline font-bold">przeglądarka:</dt>{" "}
            <dd className="inline break-all opacity-80">{report.user_agent}</dd>
          </div>
        ) : null}
      </dl>

      <div className="space-y-2 border-t border-dotted border-neutral-500 pt-3">
        <label className="block text-[10px] uppercase tracking-widest text-neutral-600">
          status (admin)
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SalesBugReportStatus)}
            disabled={pending}
            className="mt-1 block w-full border-2 border-neutral-800 bg-white px-2 py-1.5 text-xs font-bold uppercase"
          >
            <option value="open">nowe</option>
            <option value="triaged">w toku</option>
            <option value="closed">zamknięte</option>
          </select>
        </label>
        <label className="block text-[10px] uppercase tracking-widest text-neutral-600">
          notatka wewnętrzna
          <textarea
            rows={2}
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            disabled={pending}
            className="mt-1 block w-full resize-y border-2 border-neutral-800 bg-white px-2 py-1.5 text-xs"
            placeholder="co zrobiłeś / co dalej"
          />
        </label>
        <button
          type="button"
          onClick={() => save()}
          disabled={pending}
          className="border-2 border-neutral-900 bg-neutral-900 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#fff9bf] hover:bg-neutral-700 disabled:opacity-50"
        >
          {pending ? "zapisuję…" : "zapisz"}
        </button>
        {error ? <p className="text-[11px] text-red-800">{error}</p> : null}
      </div>
    </article>
  );
}

export function BugReportsAdminClient({
  initialReports,
}: {
  initialReports: SalesBugReport[];
}) {
  const [reports, setReports] = useState(initialReports);
  const [filter, setFilter] = useState<SalesBugReportStatus | "all">("open");

  const filtered = useMemo(() => {
    if (filter === "all") return reports;
    return reports.filter((r) => r.status === filter);
  }, [filter, reports]);

  const openCount = reports.filter((r) => r.status === "open").length;

  return (
    <div
      className="relative overflow-hidden rounded-sm border-4 border-double border-neutral-800 bg-[#f3f0e6] p-4 sm:p-6"
      style={{
        backgroundImage:
          "repeating-linear-gradient(transparent, transparent 27px, rgba(0,0,0,0.04) 28px)",
      }}
    >
      <header className="mb-5 border-b-4 border-neutral-800 pb-3 font-mono">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-red-700">
          {"/// poza design systemem ///"}
        </p>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-neutral-700">
          {openCount > 0 ? (
            <strong className="text-red-800">{openCount} nowych zgłoszeń czeka.</strong>
          ) : (
            "Brak nowych zgłoszeń."
          )}
        </p>
      </header>

      <div className="mb-5 flex flex-wrap gap-2 font-mono text-[11px] uppercase">
        {(
          [
            ["open", `nowe (${reports.filter((r) => r.status === "open").length})`],
            ["triaged", `w toku (${reports.filter((r) => r.status === "triaged").length})`],
            ["closed", `zamknięte (${reports.filter((r) => r.status === "closed").length})`],
            ["all", `wszystko (${reports.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "border-2 px-2.5 py-1 font-bold",
              filter === id
                ? "border-neutral-900 bg-neutral-900 text-[#fff9bf]"
                : "border-neutral-700 bg-white text-neutral-800 hover:bg-neutral-100"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="font-mono text-sm text-neutral-600">Pusto. Nikt nic nie narzekał (jeszcze).</p>
      ) : (
        <ul className="grid gap-5 lg:grid-cols-2">
          {filtered.map((report) => (
            <li key={report.id}>
              <ReportNote
                report={report}
                onUpdated={(next) =>
                  setReports((prev) => prev.map((r) => (r.id === next.id ? next : r)))
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
