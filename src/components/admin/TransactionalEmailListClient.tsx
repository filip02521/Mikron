"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminHubShell } from "@/components/admin/AdminHubShell";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { Alert } from "@/components/ui/Alert";
import { Select } from "@/components/ui/Field";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { userFacingErrorTextFromMessage } from "@/lib/ui/user-facing-error";
import { TRANSACTIONAL_EMAIL_KIND_LABELS } from "@/lib/services/transactional-email-labels";
import { formatWarsawDateTime } from "@/lib/time/warsaw";
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
      {loadError ? (
        <Alert tone="error" title="Nie udało się wczytać logów">
          {userFacingErrorTextFromMessage(loadError)}
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl<"all" | "sent" | "failed">
          value={status}
          onChange={(value) => pushFilters({ status: value })}
          ariaLabel="Status wysyłki"
          options={[
            { value: "all", label: "Wszystkie" },
            { value: "sent", label: "Wysłane" },
            { value: "failed", label: "Błędy" },
          ]}
        />
        <Select
          aria-label="Typ wiadomości"
          value={kind}
          onChange={(e) => pushFilters({ kind: e.target.value as TransactionalEmailKind | "all" })}
          className="w-full sm:w-auto sm:min-w-[14rem]"
        >
          {KIND_FILTERS.map((k) => (
            <option key={k} value={k}>
              {k === "all" ? "Wszystkie typy" : kindLabel(k)}
            </option>
          ))}
        </Select>
        <p className="ml-auto text-[0.6875rem] tabular-nums text-slate-500">
          {rows.length < total ? `ostatnie ${rows.length} z ${total}` : total}{" "}
          {polishPluralWord(total, "wysyłka", "wysyłki", "wysyłek")}
          {failedCount > 0 ? ` · ${failedCount} ${polishPluralWord(failedCount, "błąd", "błędy", "błędów")}` : ""}
        </p>
      </div>

      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title="Historia wysyłek"
          description="Pełny HTML bez automatycznej retencji - przy dużej objętości czyść starsze wiersze w transactional_email_log."
        />
        <TableScroll>
          <DataTable>
            <thead>
              <tr>
                <th>Czas</th>
                <th>Status</th>
                <th>Do</th>
                <th>Temat i typ</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-slate-500">
                    {loadError
                      ? "Brak danych do wyświetlenia (błąd wczytywania powyżej)."
                      : kind !== "all" || status !== "all"
                        ? "Brak wpisów dla wybranego filtra."
                        : "Brak wysyłek w logu - po pierwszej transakcyjnej wiadomości SES pojawi się tutaj."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap text-xs text-slate-600">
                      {formatWarsawDateTime(row.created_at)}
                    </td>
                    <td>
                      <Badge
                        variant={row.status === "sent" ? "success" : "danger"}
                      >
                        {row.status === "sent" ? "Wysłano" : "Błąd"}
                      </Badge>
                    </td>
                    <td className="max-w-[11rem] truncate font-mono text-xs">
                      {(row.to_addresses ?? []).join(", ") || "-"}
                      {row.override_to ? (
                        <span className="ml-1 text-amber-800">(override)</span>
                      ) : null}
                    </td>
                    <td className="max-w-[20rem]">
                      <Link
                        href={`/admin/wysylki/${row.id}`}
                        className="block truncate text-sm font-medium text-slate-900 hover:text-indigo-800 hover:underline"
                        title="Otwórz podgląd maila"
                      >
                        {row.subject || "(bez tematu)"}
                      </Link>
                      <span className="block truncate text-[0.6875rem] text-slate-500">{kindLabel(row.kind)}</span>
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
