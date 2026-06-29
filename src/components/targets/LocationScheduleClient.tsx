"use client";

import Link from "next/link";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { useMemo, useState, useTransition, useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLatest } from "@/hooks/useLatest";
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
  ScheduleListFilterBar,
  type ScheduleTermFilterKey,
} from "@/components/admin/SupplierHubListFilters";
import { SUPPLIER_HUB_LIST_META_DESCRIPTION } from "@/lib/supplier-hub";
import type { SupplierHubContext } from "@/lib/supplier-hub";
import type { SupplierLocation } from "@/types/database";
import {
  formatPlDate,
  locationLabel,
  vacationNoteLabel,
} from "@/lib/display-labels";
import {
  formatDateString,
  getMondayOfWeek,
  parseDateOnly,
} from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { InactiveSupplierBadge } from "@/components/suppliers/InactiveSupplierBadge";
import { inactiveSupplierRowClass, inactiveSupplierNameClass } from "@/lib/suppliers/active";
import { usePreviewMutationBlocker } from "@/components/layout/usePreviewMutationBlocker";

export interface ScheduleRow {
  id: string;
  name: string;
  is_active: boolean;
  interval_hint: string | null;
  order_date: string | null;
  shift_date: string | null;
  next_date: string | null;
  vacation_note: string | null;
  rowColor: string;
}

type FilterKey = ScheduleTermFilterKey;

function parseTermFilter(raw: string | null): FilterKey {
  if (raw === "overdue" || raw === "week" || raw === "vacation") return raw;
  return "all";
}

function isOverdue(next: string | null): boolean {
  if (!next) return false;
  return next < formatDateString(todayInWarsaw());
}

function isThisWeek(next: string | null): boolean {
  if (!next) return false;
  const d = parseDateOnly(next);
  if (!d) return false;
  const monday = getMondayOfWeek(todayInWarsaw());
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
  hubContext = "zakupy",
}: {
  location: string;
  cardsBasePath: string;
  initialRows: ScheduleRow[];
  inHubShell?: boolean;
  hubContext?: SupplierHubContext;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const [savedId, setSavedId] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const { readOnly, blockIfReadOnly } = usePreviewMutationBlocker((text) =>
    setToast({ text, tone: "error" })
  );

  const urlFiltersKey = searchParams.toString();
  const [appliedUrlFiltersKey, setAppliedUrlFiltersKey] = useState(urlFiltersKey);
  if (urlFiltersKey !== appliedUrlFiltersKey) {
    setAppliedUrlFiltersKey(urlFiltersKey);
    setSearch(searchParams.get("q")?.trim() ?? "");
    setFilter(parseTermFilter(searchParams.get("term")));
  }

  const searchParamsRef = useLatest(searchParams);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const sp = searchParamsRef.current;
      const params = new URLSearchParams(sp.toString());
      const q = search.trim();
      if (q) params.set("q", q);
      else params.delete("q");
      if (filter !== "all") params.set("term", filter);
      else params.delete("term");
      const next = params.toString();
      if (next !== sp.toString()) {
        router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, filter, pathname, router, searchParamsRef]);

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
    patch: {
      orderDate?: string | null;
      nextDate?: string | null;
      shiftDate?: string | null;
    },
    pendingLabel = "Zapis i przeliczenie harmonogramu…"
  ) => {
    if (blockIfReadOnly()) return;
    setPendingMessage(pendingLabel);
    start(async () => {
      try {
        await actionUpdateScheduleDates(row.id, patch);
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

  const filterActive = filter !== "all" || search.trim().length > 0;

  return (
    <div className="relative space-y-4">
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

      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title={
            inHubShell
              ? `Terminy (${filtered.length}${filterActive ? ` z ${initialRows.length}` : ""})`
              : `Terminy · ${locLabel} (${filtered.length}${filterActive ? ` z ${initialRows.length}` : ""})`
          }
          description={`Kliknij datę, aby zapisać. Kolory = pilność. ${SUPPLIER_HUB_LIST_META_DESCRIPTION}`}
        />

        <ScheduleListFilterBar
          location={location as SupplierLocation}
          context={hubContext}
          termFilter={filter}
          onTermFilterChange={setFilter}
          termCounts={counts}
          search={search}
          onSearchChange={setSearch}
        />

        <div className="border-b border-slate-100 px-3 pb-3 sm:px-4 lg:px-5">
          <ColorLegend />
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
                    className={cn(
                      inactiveSupplierRowClass(row.is_active),
                      savedId === row.id && "ring-2 ring-inset ring-emerald-400"
                    )}
                  >
                    <td className={cn("font-semibold", inactiveSupplierNameClass(row.is_active))}>
                      <p className="flex flex-wrap items-center gap-2">
                        <span>{row.name}</span>
                        {!row.is_active ? (
                          <InactiveSupplierBadge className="text-[10px]" />
                        ) : null}
                      </p>
                      {row.interval_hint ? (
                        <p className="mt-0.5 text-[11px] font-normal text-slate-500">
                          Cykl: {row.interval_hint}
                        </p>
                      ) : null}
                      <Link
                        href={cardHref(cardsBasePath, row.name)}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline"
                      >
                        Karta dostawcy
                        <LinkChevron size={13} tone="sky" />
                      </Link>
                      {savedId === row.id ? (
                        <span className="ml-2 text-xs font-normal text-emerald-700">
                          Zapisano
                        </span>
                      ) : null}
                    </td>
                    <DateCell
                      value={row.order_date}
                      disabled={readOnly || pending}
                      hint={formatPlDate(row.order_date)}
                      onSave={(v) =>
                        save(row, { orderDate: v }, "Zapisywanie daty ostatniego zamówienia…")
                      }
                    />
                    <DateCell
                      value={row.next_date}
                      disabled={readOnly || pending}
                      hint={`${formatPlDate(row.next_date)} · zapis jako przesunięcie`}
                      onSave={(v) =>
                        save(row, { nextDate: v }, "Aktualizacja kolejnego zamówienia…")
                      }
                    />
                    <DateCell
                      value={row.shift_date}
                      disabled={readOnly || pending}
                      hint={formatPlDate(row.shift_date)}
                      onSave={(v) =>
                        save(row, { shiftDate: v }, "Zapisywanie przesunięcia…")
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
