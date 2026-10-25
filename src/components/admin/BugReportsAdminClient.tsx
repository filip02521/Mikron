"use client";

import { useMemo, useState, useTransition } from "react";
import { userFacingErrorTextFromMessage } from "@/lib/ui/user-facing-error";
import { actionUpdateSalesBugReport } from "@/app/actions/sales-bug-report";
import type { SalesBugReport, SalesBugReportStatus } from "@/types/database";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Select, fieldControlClass } from "@/components/ui/Field";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spinner } from "@/components/ui/Spinner";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { formatWarsawDateTime } from "@/lib/time/warsaw";

const STATUS_LABEL: Record<SalesBugReportStatus, string> = {
  open: "Nowe",
  triaged: "W toku",
  closed: "Zamknięte",
};

const STATUS_BADGE: Record<SalesBugReportStatus, "warning" | "info" | "success"> = {
  open: "warning",
  triaged: "info",
  closed: "success",
};

type Filter = SalesBugReportStatus | "all";

function ReportItem({
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
  const dirty = status !== report.status || adminNote !== (report.admin_note ?? "");

  function save() {
    setError(null);
    start(async () => {
      const result = await actionUpdateSalesBugReport({
        id: report.id,
        status,
        adminNote,
      });
      if (!result.ok) {
        setError(userFacingErrorTextFromMessage(result.error, "Nie udało się zapisać."));
        return;
      }
      onUpdated(result.report);
    });
  }

  return (
    <article className="space-y-3 px-4 py-4 sm:px-5 lg:px-6">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{report.reporter_name}</p>
          <p className="text-[0.6875rem] text-slate-500">
            <span className="break-all">{report.reporter_email ?? "-"}</span> ·{" "}
            <span className="tabular-nums">{formatWarsawDateTime(report.created_at)}</span>
          </p>
        </div>
        <Badge variant={STATUS_BADGE[report.status]}>{STATUS_LABEL[report.status]}</Badge>
      </header>

      <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-slate-800">{report.message}</p>

      <dl className="space-y-0.5 text-[0.6875rem] text-slate-500">
        <div>
          <dt className="inline font-medium text-slate-600">Strona:</dt>{" "}
          <dd className="inline break-all font-mono">{report.page_path}</dd>
        </div>
        {report.user_agent ? (
          <div>
            <dt className="inline font-medium text-slate-600">Przeglądarka:</dt>{" "}
            <dd className="inline break-all">{report.user_agent}</dd>
          </div>
        ) : null}
      </dl>

      <div className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-start">
        <Field label="Status">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as SalesBugReportStatus)}
            disabled={pending}
          >
            <option value="open">Nowe</option>
            <option value="triaged">W toku</option>
            <option value="closed">Zamknięte</option>
          </Select>
        </Field>
        <Field label="Notatka wewnętrzna">
          <textarea
            rows={2}
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            disabled={pending}
            className={fieldControlClass("default", "resize-y")}
            placeholder="Co zrobiono i co dalej"
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button variant="secondary" size="sm" onClick={save} disabled={pending || !dirty}>
            {pending ? (
              <>
                <Spinner size="sm" />
                Zapisuję…
              </>
            ) : (
              "Zapisz"
            )}
          </Button>
          {!dirty && !pending ? (
            <span className="text-[0.6875rem] text-slate-500">Zmień status lub notatkę, żeby zapisać.</span>
          ) : null}
          {error ? <p className="text-xs text-red-700">{error}</p> : null}
        </div>
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
  const [filter, setFilter] = useState<Filter>("open");

  const filtered = useMemo(() => {
    if (filter === "all") return reports;
    return reports.filter((r) => r.status === filter);
  }, [filter, reports]);

  const count = (s: SalesBugReportStatus) => reports.filter((r) => r.status === s).length;
  const openCount = count("open");
  const segLabel = (label: string, n: number) => (
    <>
      {label} <span className="tabular-nums text-slate-500">{n}</span>
    </>
  );

  return (
    <div className="space-y-5">
      <p className="text-[0.9375rem] text-slate-700">
        {openCount > 0
          ? `${openCount} ${polishPluralWord(openCount, "nowe zgłoszenie czeka", "nowe zgłoszenia czekają", "nowych zgłoszeń czeka")} na odpowiedź.`
          : "Brak nowych zgłoszeń."}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl<Filter>
          value={filter}
          onChange={setFilter}
          ariaLabel="Status zgłoszeń"
          options={[
            { value: "open", label: segLabel("Nowe", openCount) },
            { value: "triaged", label: segLabel("W toku", count("triaged")) },
            { value: "closed", label: segLabel("Zamknięte", count("closed")) },
            { value: "all", label: segLabel("Wszystkie", reports.length) },
          ]}
        />
        <p className="ml-auto text-[0.6875rem] tabular-nums text-slate-500" aria-live="polite">
          {filtered.length} {polishPluralWord(filtered.length, "zgłoszenie", "zgłoszenia", "zgłoszeń")}
        </p>
      </div>

      <Card padding={false} className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            title={filter === "open" ? "Brak nowych zgłoszeń" : "Brak zgłoszeń w tym widoku"}
            description="Zgłoszenia wysyłają handlowcy przyciskiem „Zgłoś problem” w swoim panelu."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((report) => (
              <li key={report.id}>
                <ReportItem
                  report={report}
                  onUpdated={(next) =>
                    setReports((prev) => prev.map((r) => (r.id === next.id ? next : r)))
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
