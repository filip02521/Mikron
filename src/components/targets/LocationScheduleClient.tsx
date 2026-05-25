"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { actionUpdateScheduleDates } from "@/app/actions/admin";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { Toast } from "@/components/ui/Toast";
import { ColorLegend } from "@/components/summary/ColorLegend";
import {
  formatPlDate,
  locationLabel,
  vacationNoteLabel,
} from "@/lib/display-labels";
import {
  formatDateString,
  getMondayOfWeek,
  parseDateOnly,
  toDateOnly,
} from "@/lib/orders/dates";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";

export interface ScheduleRow {
  id: string;
  name: string;
  interval_hint: string | null;
  order_date: string | null;
  shift_date: string | null;
  next_date: string | null;
  vacation_note: string | null;
  rowColor: string;
}

type FilterKey = "all" | "overdue" | "week" | "vacation";

function isOverdue(next: string | null): boolean {
  if (!next) return false;
  return next < formatDateString(toDateOnly(new Date()));
}

function isThisWeek(next: string | null): boolean {
  if (!next) return false;
  const d = parseDateOnly(next);
  if (!d) return false;
  const monday = getMondayOfWeek(new Date());
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return d >= monday && d <= sunday;
}

function sortBySupplierName(a: ScheduleRow, b: ScheduleRow): number {
  return a.name.localeCompare(b.name, "pl", { sensitivity: "base" });
}

function cardHref(base: string, name: string): string {
  return `${base}?q=${encodeURIComponent(name)}`;
}

export function LocationScheduleClient({
  location,
  cardsBasePath,
  initialRows,
  inHubShell = false,
}: {
  location: string;
  cardsBasePath: string;
  initialRows: ScheduleRow[];
  inHubShell?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    const q = searchParams.get("q")?.trim();
    if (q) setSearch(q);
  }, [searchParams]);

  const dismissToast = useCallback(() => setToast(null), []);

  const filtered = useMemo(() => {
    let rows = [...initialRows];
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q));

    if (filter === "overdue") rows = rows.filter((r) => isOverdue(r.next_date));
    else if (filter === "week")
      rows = rows.filter((r) => isThisWeek(r.next_date) || isOverdue(r.next_date));
    else if (filter === "vacation")
      rows = rows.filter((r) => !!r.vacation_note);

    return rows.sort(sortBySupplierName);
  }, [initialRows, filter, search]);

  const counts = useMemo(
    () => ({
      all: initialRows.length,
      overdue: initialRows.filter((r) => isOverdue(r.next_date)).length,
      week: initialRows.filter(
        (r) => isThisWeek(r.next_date) || isOverdue(r.next_date)
      ).length,
      vacation: initialRows.filter((r) => r.vacation_note).length,
    }),
    [initialRows]
  );

  const save = (
    row: ScheduleRow,
    patch: Partial<{
      order_date: string | null;
      next_date: string | null;
      shift_date: string | null;
    }>,
    pendingLabel = "Zapis i przeliczenie harmonogramu…"
  ) => {
    setPendingMessage(pendingLabel);
    start(async () => {
      try {
        await actionUpdateScheduleDates(
          row.id,
          patch.order_date !== undefined ? patch.order_date : row.order_date,
          patch.next_date !== undefined ? patch.next_date : row.next_date,
          patch.shift_date !== undefined ? patch.shift_date : row.shift_date
        );
        router.refresh();
        setSavedId(row.id);
        setTimeout(() => setSavedId((id) => (id === row.id ? null : id)), 2000);
        setToast({ text: `Zapisano · ${row.name}`, tone: "success" });
      } catch (e) {
        setToast({
          text: e instanceof Error ? e.message : "Nie udało się zapisać",
          tone: "error",
        });
      } finally {
        setPendingMessage(null);
      }
    });
  };

  const locLabel = locationLabel(location);

  return (
    <div
      className={cn(
        "relative space-y-4",
        inHubShell && "p-4 sm:p-5"
      )}
    >
      {pendingMessage ? (
        <ActionLoadingOverlay
          message={pendingMessage}
          hint="Zapisujemy i przeliczamy terminy tego dostawcy"
          variant="viewport"
        />
      ) : null}
      {toast ? (
        <Toast message={toast.text} tone={toast.tone} onDismiss={dismissToast} />
      ) : null}

      <ColorLegend />

      <Card padding={false}>
        <CardHeader
          inset
          title={
            inHubShell
              ? `Lista dostawców (${filtered.length}${filter !== "all" || search.trim() ? ` z ${initialRows.length}` : ""})`
              : `Terminy · ${locLabel} (${filtered.length}${filter !== "all" || search.trim() ? ` z ${initialRows.length}` : ""})`
          }
          description="Kliknij datę, aby zapisać. Kolory = pilność następnego zamówienia. Ustawienia karty — link przy nazwie."
        />

        <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-4">
          <Input
            type="search"
            placeholder="Szukaj dostawcy…"
            className="max-w-sm py-2 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Filtr terminów
              <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-400">
                (tylko ta lista)
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "Wszystkie"],
                  ["overdue", "Po terminie"],
                  ["week", "Ten tydzień"],
                  ["vacation", "Z urlopem"],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={filter === key ? "primary" : "secondary"}
                  onClick={() => setFilter(key)}
                >
                  {label} ({counts[key]})
                </Button>
              ))}
            </div>
          </div>
        </div>

        {!filtered.length ? (
          <EmptyState
            title={
              initialRows.length
                ? "Brak wyników dla filtra"
                : "Brak dostawców"
            }
            description={
              initialRows.length
                ? "Zmień filtr lub wyszukiwanie."
                : `Dodaj dostawców (${locLabel}) w kartach dostawców.`
            }
            action={
              initialRows.length ? undefined : (
                <Link href={cardsBasePath}>
                  <Button variant="secondary" size="sm">
                    Przejdź do kart dostawców
                  </Button>
                </Link>
              )
            }
          />
        ) : (
          <TableScroll>
            <DataTable>
              <thead>
                <tr>
                  <th>Dostawca</th>
                  <th>Ostatnie zamówienie</th>
                  <th>Następne zamówienie</th>
                  <th>Przesunięcie</th>
                  <th>Urlop</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    style={{ backgroundColor: row.rowColor }}
                    className={cn(savedId === row.id && "ring-2 ring-inset ring-emerald-400")}
                  >
                    <td className="font-semibold text-slate-900">
                      <p>{row.name}</p>
                      {row.interval_hint ? (
                        <p className="mt-0.5 text-[11px] font-normal text-slate-500">
                          Cykl: {row.interval_hint}
                        </p>
                      ) : null}
                      <Link
                        href={cardHref(cardsBasePath, row.name)}
                        className="mt-1 inline-block text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline"
                      >
                        Karta dostawcy →
                      </Link>
                      {savedId === row.id ? (
                        <span className="ml-2 text-xs font-normal text-emerald-700">
                          Zapisano
                        </span>
                      ) : null}
                    </td>
                    <DateCell
                      value={row.order_date}
                      disabled={pending}
                      hint={formatPlDate(row.order_date)}
                      onSave={(v) =>
                        save(row, { order_date: v }, "Zapisywanie daty ostatniego zamówienia…")
                      }
                    />
                    <DateCell
                      value={row.next_date}
                      disabled={pending}
                      hint={formatPlDate(row.next_date)}
                      onSave={(v) =>
                        save(row, { next_date: v }, "Aktualizacja kolejnego zamówienia…")
                      }
                    />
                    <DateCell
                      value={row.shift_date}
                      disabled={pending}
                      hint={formatPlDate(row.shift_date)}
                      onSave={(v) =>
                        save(row, { shift_date: v }, "Zapisywanie przesunięcia…")
                      }
                    />
                    <td>
                      {row.vacation_note ? (
                        <Badge variant="warning">
                          {vacationNoteLabel(row.vacation_note)}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableScroll>
        )}
      </Card>
    </div>
  );
}

function DateCell({
  value,
  hint,
  disabled,
  onSave,
}: {
  value: string | null;
  hint: string;
  disabled?: boolean;
  onSave: (iso: string | null) => void;
}) {
  return (
    <td>
      <div className="space-y-0.5">
        <Input
          type="date"
          className="py-1.5 text-xs"
          value={value ?? ""}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value || null;
            if (next !== (value ?? null)) onSave(next);
          }}
        />
        <p className="text-[10px] text-slate-500 tabular-nums">{hint}</p>
      </div>
    </td>
  );
}
