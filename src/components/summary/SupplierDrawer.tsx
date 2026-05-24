"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { SupplierSummaryMeta } from "@/lib/orders/summary-workspace";
import { SupplierContactActions } from "@/components/procurement/SupplierContactActions";
import {
  formatPlDate,
  formatStockPeriod,
  formatSupplierInterval,
  locationLabel,
  vacationNoteLabel,
} from "@/lib/display-labels";
import { Button } from "@/components/ui/Button";
import { ShiftMenu } from "@/components/summary/ShiftMenu";
import { actionFetchSupplierRecentHistory, actionMarkOrdered, actionShiftOrder } from "@/app/actions/admin";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import { cn } from "@/lib/cn";

type HistoryRow = {
  action_at: string;
  action: string;
  user_email: string;
  next_date: string | null;
};

export function SupplierDrawer({
  supplier,
  onClose,
  pending,
  run,
  onVacation,
  onEdit,
}: {
  supplier: SupplierSummaryMeta | null;
  onClose: () => void;
  pending: boolean;
  run: DailyPanelRunFn;
  onVacation: () => void;
  onEdit: () => void;
}) {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!supplier?.id) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    actionFetchSupplierRecentHistory(supplier.id)
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supplier?.id]);

  if (!supplier) return null;

  const scheduleHref = `/lokalizacje/${supplier.location}?q=${encodeURIComponent(supplier.name)}`;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-pointer bg-slate-900/30"
        aria-label="Zamknij panel"
        onClick={onClose}
      />
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-xl"
        aria-labelledby="supplier-drawer-title"
      >
        <header className="shrink-0 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">
                {locationLabel(supplier.location)}
              </p>
              <h2
                id="supplier-drawer-title"
                className="mt-0.5 truncate text-lg font-semibold text-slate-900"
              >
                {supplier.name}
              </h2>
              {supplier.vacation_note ? (
                <p className="mt-1 text-xs font-medium text-amber-800">
                  {vacationNoteLabel(supplier.vacation_note)}
                </p>
              ) : null}
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0">
              Zamknij
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  () => actionMarkOrdered(supplier.id),
                  "Oznaczono jako zamówione",
                  "Oznaczanie jako zamówione…"
                )
              }
            >
              Zamówione
            </Button>
            <ShiftMenu
              disabled={pending}
              onShiftWeeks={(w) =>
                run(
                  () => actionShiftOrder(supplier.id, w, null),
                  `Przesunięto o ${w} ${w === 1 ? "tydzień" : "tygodnie"}`,
                  `Przesuwanie terminu…`
                )
              }
              onShiftDate={(iso) =>
                run(
                  () => actionShiftOrder(supplier.id, null, iso),
                  "Ustawiono datę przesunięcia",
                  "Zapisywanie daty…"
                )
              }
            />
            <Button variant="secondary" size="sm" disabled={pending} onClick={onVacation}>
              Urlop
            </Button>
            <Button variant="secondary" size="sm" disabled={pending} onClick={onEdit}>
              Edytuj
            </Button>
            <Link href={scheduleHref}>
              <Button variant="ghost" size="sm">
                Terminy
              </Button>
            </Link>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Skróty: <kbd className="rounded bg-slate-100 px-1">Z</kbd> zamówione ·{" "}
            <kbd className="rounded bg-slate-100 px-1">Esc</kbd> zamknij
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <DateCard
              label="Ostatnie zamówienie"
              value={formatPlDate(supplier.order_date)}
            />
            <DateCard
              label="Planowane zamówienie"
              value={formatPlDate(supplier.computed_next_date)}
              emphasize
            />
          </div>

          {supplier.shift_date ? (
            <p className="mt-3 text-sm text-slate-600">
              <span className="text-slate-500">Ręczne przesunięcie:</span>{" "}
              <span className="font-medium text-slate-800">
                {formatPlDate(supplier.shift_date)}
              </span>
            </p>
          ) : null}

          <DrawerBlock title="Kontakt i zamówienia" className="mt-6">
            <SupplierContactActions
              notes={supplier.notes}
              mails={supplier.mails}
              extraInfo={supplier.extra_info}
            />
            {supplier.extra_info?.trim() && supplier.mails?.trim() ? (
              <p className="mt-3 text-sm text-slate-600">
                <span className="text-slate-500">Uwagi: </span>
                {supplier.extra_info}
              </p>
            ) : null}
          </DrawerBlock>

          {supplier.order_on_demand ? (
            <p className="mt-4 rounded-lg border border-violet-200 bg-violet-50/80 px-3 py-2 text-sm text-violet-900">
              <span className="font-medium">Tylko w razie potrzeby</span>
              <span className="text-violet-700">
                {" "}
                — bez stałego terminu w planie tygodnia. Zamówienie z listy w panelu
                dziennym.
              </span>
            </p>
          ) : null}

          <DrawerBlock title="Harmonogram dostaw" className="mt-6">
            <dl className="space-y-3 text-sm">
              <Field
                label="Częstotliwość zamówień"
                value={formatSupplierInterval(
                  supplier.interval_raw,
                  supplier.interval_weeks
                )}
              />
              <Field
                label="Zapas (okres)"
                value={formatStockPeriod(supplier.stock_raw, supplier.stock)}
              />
            </dl>
          </DrawerBlock>

          <DrawerBlock title="Ostatnie akcje" className="mt-6">
            {historyLoading ? (
              <p className="text-sm text-slate-500">Ładowanie historii…</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-slate-500">Brak zapisów w historii.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {history.map((h, i) => (
                  <li
                    key={`${h.action_at}-${i}`}
                    className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
                  >
                    <p className="font-medium text-slate-800">{h.action}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatPlDate(h.action_at.slice(0, 10))} · {h.user_email}
                      {h.next_date ? ` → ${formatPlDate(h.next_date)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </DrawerBlock>

          <DrawerBlock title="Odbiór towaru" className="mt-6">
            <ul className="space-y-1 text-sm text-slate-800">
              {supplier.pickup_mikran ? (
                <li className="flex gap-2">
                  <span className="text-slate-400" aria-hidden>
                    —
                  </span>
                  Kierowca Mikran
                </li>
              ) : null}
              {supplier.pickup_pallet ? (
                <li className="flex gap-2">
                  <span className="text-slate-400" aria-hidden>
                    —
                  </span>
                  Zlecenie odbioru palety
                </li>
              ) : null}
              {!supplier.pickup_mikran && !supplier.pickup_pallet ? (
                <li className="text-slate-500">Brak zleconego odbioru</li>
              ) : null}
            </ul>
          </DrawerBlock>
        </div>
      </aside>
    </>
  );
}

function DateCard({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        emphasize ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white"
      )}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 tabular-nums",
          emphasize ? "text-base font-semibold text-slate-900" : "font-medium text-slate-800"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function DrawerBlock({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900">{value}</dd>
    </div>
  );
}
