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
import { LOCATION_SCHEDULE_TOAST, toastFromError, type ToastNotice } from "@/lib/ui/notice-copy";
import { NoticeToast } from "@/components/ui/NoticeToast";
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
import { IconCalendar, IconClock, IconSun } from "@/components/icons/StrokeIcons";
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

type SortKey = "name" | "order_date" | "next_date" | "shift_date" | "vacation_note";
type SortDir = "asc" | "desc";

function compareRows(a: ScheduleRow, b: ScheduleRow, key: SortKey, dir: SortDir): number {
  let cmp = 0;
  switch (key) {
    case "name":
      cmp = a.name.localeCompare(b.name, "pl", { sensitivity: "base" });
      break;
    case "order_date":
      cmp = (a.order_date ?? "").localeCompare(b.order_date ?? "");
      break;
    case "next_date":
      cmp = (a.next_date ?? "").localeCompare(b.next_date ?? "");
      break;
    case "shift_date":
      cmp = (a.shift_date ?? "").localeCompare(b.shift_date ?? "");
      break;
    case "vacation_note":
      cmp = (a.vacation_note ?? "").localeCompare(b.vacation_note ?? "");
      break;
  }
  if (cmp === 0 && key !== "name") {
    cmp = a.name.localeCompare(b.name, "pl", { sensitivity: "base" });
  }
  return dir === "asc" ? cmp : -cmp;
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
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const { readOnly, blockIfReadOnly } = usePreviewMutationBlocker((text) =>
    setToast(toastFromError(text)),
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

    return rows.sort((a, b) => compareRows(a, b, sortKey, sortDir));
  }, [initialRows, filter, search, sortKey, sortDir]);

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
        setToast(LOCATION_SCHEDULE_TOAST.saved(row.name));
      } catch (e) {
        setToast(toastFromError(e instanceof Error ? e.message : undefined));
      } finally {
        setPendingMessage(null);
      }
    });
  };

  const locLabel = locationLabel(location);

  const handleSort = useCallback((field: SortKey) => {
    if (field === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(field);
      setSortDir("asc");
    }
  }, [sortKey]);

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
        <NoticeToast notice={toast} onDismiss={dismissToast} />
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
                  <SortableTh label="Dostawca" sortKey={sortKey} sortDir={sortDir} field="name" onSort={handleSort} />
                  <SortableTh label="Ostatnie zamówienie" sortKey={sortKey} sortDir={sortDir} field="order_date" onSort={handleSort} />
                  <SortableTh label="Następne zamówienie" sortKey={sortKey} sortDir={sortDir} field="next_date" onSort={handleSort} />
                  <SortableTh label="Przesunięcie" sortKey={sortKey} sortDir={sortDir} field="shift_date" onSort={handleSort} />
                  <SortableTh label="Urlop" sortKey={sortKey} sortDir={sortDir} field="vacation_note" onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    style={{ backgroundColor: row.rowColor }}
                    className={cn(
                      "transition-colors hover:brightness-95",
                      inactiveSupplierRowClass(row.is_active),
                      savedId === row.id && "ring-2 ring-inset ring-emerald-400"
                    )}
                  >
                    <td className={cn("font-semibold", inactiveSupplierNameClass(row.is_active))}>
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold ring-1 ring-inset",
                            row.is_active
                              ? "bg-indigo-50 text-indigo-700 ring-indigo-100/60"
                              : "bg-slate-100 text-slate-400 ring-slate-200/60"
                          )}
                          aria-hidden
                        >
                          {row.name.charAt(0).toUpperCase() || "?"}
                        </span>
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2">
                            <span>{row.name}</span>
                            {!row.is_active ? (
                              <InactiveSupplierBadge className="text-[10px]" />
                            ) : null}
                          </p>
                          {row.interval_hint ? (
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] font-normal text-slate-500">
                              <IconClock size={11} className="shrink-0 text-slate-400" />
                              {row.interval_hint}
                            </p>
                          ) : null}
                          <Link
                            href={cardHref(cardsBasePath, row.name)}
                            className="mt-1 flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline"
                          >
                            Karta dostawcy
                            <LinkChevron size={13} tone="sky" />
                          </Link>
                          {savedId === row.id ? (
                            <p className="mt-0.5 text-xs font-normal text-emerald-700">
                              Zapisano
                            </p>
                          ) : null}
                        </div>
                      </div>
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
                        <Badge variant="warning" className="gap-1">
                          <IconSun size={11} className="text-amber-500" />
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

function SortableTh({
  label,
  sortKey,
  sortDir,
  field,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sortDir: SortDir;
  field: SortKey;
  onSort: (field: SortKey) => void;
}) {
  const isActive = sortKey === field;
  return (
    <th>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "inline-flex items-center gap-1 text-left font-semibold transition-colors hover:text-slate-900",
          isActive ? "text-slate-900" : "text-slate-600",
        )}
      >
        {label}
        {isActive ? (
          <span className="text-xs">
            {sortDir === "asc" ? "▲" : "▼"}
          </span>
        ) : (
          <span className="text-xs text-slate-300">↕</span>
        )}
      </button>
    </th>
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
        <p className="flex items-center gap-1 text-[10px] text-slate-500 tabular-nums">
          <IconCalendar size={10} className="shrink-0 text-slate-400" />
          {hint}
        </p>
      </div>
    </td>
  );
}
