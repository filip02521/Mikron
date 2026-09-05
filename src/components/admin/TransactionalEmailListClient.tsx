"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminHubShell } from "@/components/admin/AdminHubShell";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { PanelSummaryMetric } from "@/components/ui/PanelSummaryMetric";
import { TRANSACTIONAL_EMAIL_KIND_LABELS } from "@/lib/services/transactional-email-labels";
import { formatWarsawDateTime } from "@/lib/time/warsaw";
import { panelTypography } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";
import type {
  TransactionalEmailKind,
  TransactionalEmailLog,
} from "@/types/database";

const KIND_FILTERS: Array<TransactionalEmailKind | "all"> = [
  "all",
  "delivery",
  "informacja",
  "procurement_cancel",
  "request_note_update",
  "board_reply",
  "password_reset_otp",
  "generic",
  "attachments",
];

function kindLabel(kind: string): string {
  return (
    TRANSACTIONAL_EMAIL_KIND_LABELS[kind as TransactionalEmailKind] ?? kind
  );
}

export function TransactionalEmailListClient({
  rows,
  total,
  kind,
  status,
  loadError,
}: {
  rows: TransactionalEmailLog[];
  total: number;
  kind: TransactionalEmailKind | "all";
  status: "sent" | "failed" | "all";
  loadError?: string;
}) {
  const router = useRouter();
  const sentCount = rows.filter((r) => r.status === "sent").length;
  const failedCount = rows.filter((r) => r.status === "failed").length;

  function pushFilters(next: {
    kind?: TransactionalEmailKind | "all";
    status?: "sent" | "failed" | "all";
  }) {
    const params = new URLSearchParams();
    const k = next.kind ?? kind;
    const s = next.status ?? status;
    if (k !== "all") params.set("kind", k);
    if (s !== "all") params.set("status", s);
    const q = params.toString();
    router.push(q ? `/admin/wysylki?${q}` : "/admin/wysylki");
  }

  return (
    <AdminHubShell activeTab="wysylki">
      <p className={cn(panelTypography.sectionDesc, "mb-3")}>
        Każda wysyłka SES z OnTime jest zapisywana z treścią HTML (pełny HTML —
        bez automatycznej retencji; przy dużej objętości rozważ okresowe czyszczenie
        starszych wierszy w <code>transactional_email_log</code>). Kody OTP w
        podglądzie są zredagowane (<code>••••••</code>). Lista pokazuje ostatnie
        wpisy (łącznie w filtrze: {total}).
      </p>

      {loadError ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Nie udało się wczytać logów: {loadError}
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <PanelSummaryMetric label="W filtrze" value={String(total)} />
        <PanelSummaryMetric label="Wysłane (strona)" value={String(sentCount)} />
        <PanelSummaryMetric label="Błędy (strona)" value={String(failedCount)} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {KIND_FILTERS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => pushFilters({ kind: k })}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs",
              kind === k
                ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            {k === "all" ? "Wszystkie typy" : kindLabel(k)}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["all", "Wszystkie statusy"],
            ["sent", "Wysłane"],
            ["failed", "Błędy"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => pushFilters({ status: value })}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs",
              status === value
                ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <Card padding={false} className="overflow-hidden">
        <CardHeader inset density="compact" title="Historia wysyłek" />
        <TableScroll>
          <DataTable>
            <thead>
              <tr>
                <th>Czas</th>
                <th>Typ</th>
                <th>Status</th>
                <th>Do</th>
                <th>Temat</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-slate-500">
                    {loadError
                      ? "Brak danych do wyświetlenia (błąd wczytywania powyżej)."
                      : kind !== "all" || status !== "all"
                        ? "Brak wpisów dla wybranego filtra."
                        : "Brak wysyłek w logu — po pierwszej transakcyjnej wiadomości SES pojawi się tutaj."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap text-xs text-slate-600">
                      {formatWarsawDateTime(row.created_at)}
                    </td>
                    <td className="text-xs">{kindLabel(row.kind)}</td>
                    <td>
                      <Badge
                        variant={row.status === "sent" ? "success" : "danger"}
                      >
                        {row.status === "sent" ? "wysłano" : "błąd"}
                      </Badge>
                    </td>
                    <td className="max-w-[12rem] truncate text-xs font-mono">
                      {(row.to_addresses ?? []).join(", ") || "—"}
                      {row.override_to ? (
                        <span className="ml-1 text-amber-700">(override)</span>
                      ) : null}
                    </td>
                    <td className="max-w-[18rem] truncate text-sm">
                      {row.subject || "—"}
                    </td>
                    <td>
                      <Link
                        href={`/admin/wysylki/${row.id}`}
                        className="text-xs font-medium text-indigo-700 hover:underline"
                      >
                        Podgląd
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </DataTable>
        </TableScroll>
      </Card>
    </AdminHubShell>
  );
}
