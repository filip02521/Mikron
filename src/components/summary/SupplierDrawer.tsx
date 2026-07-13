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
import { SCROLL_LOCK_ALLOW_ATTR, useBodyScrollLock } from "@/lib/ui/page-scroll-lock";
import { cn } from "@/lib/cn";
import { sidePanelBackdropClass, sidePanelShellClass, sidePanelCloseButtonClass, sidePanelHeaderClass, sidePanelContentClass } from "@/lib/ui/surfaces";
import {
  IconX,
  IconBuilding,
  IconCalendar,
  IconClock,
  IconTruck,
  IconPackageCheck,
  IconLink,
  IconLinkOff,
  IconCircleCheck,
  IconSun,
  IconMail,
} from "@/components/icons/StrokeIcons";
import { useSupplierHubContext } from "@/components/layout/AppRoleContext";
import { supplierCardsHref } from "@/lib/supplier-hub";
import { TeethDualLaneNotice } from "@/components/teeth/TeethDualLaneNotice";
import type { TeethSupplierLaneSnapshot } from "@/lib/data/teeth-schedule";
import { TEETH_DUAL_LANE_COPY } from "@/lib/teeth/teeth-supplier-dual-lane";

type HistoryRow = {
  action_at: string;
  action: string;
  user_email: string;
  next_date: string | null;
};

const SUPPLIER_HISTORY_CACHE_TTL_MS = 60_000;
const supplierHistoryCache = new Map<
  string,
  { at: number; rows: HistoryRow[] }
>();

export function SupplierDrawer({
  supplier,
  teethLane,
  onClose,
  isScopePending,
  run,
  onVacation,
  onEdit,
}: {
  supplier: SupplierSummaryMeta | null;
  teethLane?: TeethSupplierLaneSnapshot | null;
  onClose: () => void;
  isScopePending: (supplierId: string) => boolean;
  run: DailyPanelRunFn;
  onVacation: () => void;
  onEdit: () => void;
}) {
  const hubContext = useSupplierHubContext();
  useBodyScrollLock(Boolean(supplier));
  const supplierId = supplier?.id ?? null;
  const [historyState, setHistoryState] = useState<{
    supplierId: string | null;
    rows: HistoryRow[];
    loading: boolean;
  }>({ supplierId: null, rows: [], loading: false });

  useEffect(() => {
    if (!supplierId) return;
    let cancelled = false;
    const cached = supplierHistoryCache.get(supplierId);
    if (cached && Date.now() - cached.at < SUPPLIER_HISTORY_CACHE_TTL_MS) {
      queueMicrotask(() => {
        if (!cancelled) {
          setHistoryState({ supplierId, rows: cached.rows, loading: false });
        }
      });
      return;
    }

    queueMicrotask(() => {
      if (!cancelled) {
        setHistoryState({ supplierId, rows: [], loading: true });
      }
    });
    actionFetchSupplierRecentHistory(supplierId)
      .then((rows) => {
        if (!cancelled) {
          supplierHistoryCache.set(supplierId, { at: Date.now(), rows });
          setHistoryState({ supplierId, rows, loading: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHistoryState({ supplierId, rows: [], loading: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  if (!supplier) return null;

  const history = historyState.supplierId === supplier.id ? historyState.rows : [];
  const historyLoading = historyState.supplierId === supplier.id && historyState.loading;

  const rowPending = isScopePending(supplier.id);
  const scope = { scope: supplier.id };
  const scheduleHref = `/lokalizacje/${supplier.location}?q=${encodeURIComponent(supplier.name)}`;
  const cardsHref = supplierCardsHref(hubContext, {
    q: supplier.name,
    ...(supplier.subiekt_kh_id == null ? { powiaz: true as const } : {}),
  });

  return (
    <>
      <button
        type="button"
        className={cn(sidePanelBackdropClass, "panel-slide-backdrop-enter")}
        aria-label="Zamknij panel"
        onClick={onClose}
      />
      <aside
        className={cn(sidePanelShellClass, "panel-slide-enter")}
        aria-labelledby="supplier-drawer-title"
      >
        <header className={sidePanelHeaderClass}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <IconBuilding size={13} className="shrink-0 text-slate-400" />
                {locationLabel(supplier.location)}
              </div>
              <h2
                id="supplier-drawer-title"
                className="mt-1 truncate text-lg font-semibold text-slate-900"
              >
                {supplier.name}
              </h2>
              {supplier.vacation_note ? (
                <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200/60">
                  <IconSun size={12} className="shrink-0" />
                  {vacationNoteLabel(supplier.vacation_note)}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className={sidePanelCloseButtonClass}
              onClick={onClose}
              aria-label="Zamknij"
            >
              <IconX size={18} />
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            <Button
              variant="primary"
              size="sm"
              disabled={rowPending}
              className="w-full justify-center"
              onClick={() =>
                run(
                  () => actionMarkOrdered(supplier.id),
                  "Oznaczono jako zamówione",
                  "Oznaczanie jako zamówione…",
                  scope
                )
              }
            >
              <IconCircleCheck size={15} className="shrink-0" />
              Zamówione
            </Button>
            <div className="flex flex-wrap gap-2">
              <ShiftMenu
                disabled={rowPending}
                onShiftWeeks={(w) =>
                  run(
                    () => actionShiftOrder(supplier.id, w, null),
                    `Przesunięto o ${w} ${w === 1 ? "tydzień" : "tygodnie"}`,
                    `Przesuwanie terminu…`,
                    scope
                  )
                }
                onShiftDate={(iso) =>
                  run(
                    () => actionShiftOrder(supplier.id, null, iso),
                    "Ustawiono datę przesunięcia",
                    "Zapisywanie daty…",
                    scope
                  )
                }
              />
              <Button variant="secondary" size="sm" disabled={rowPending} onClick={onVacation}>
                Urlop
              </Button>
              <Button variant="secondary" size="sm" disabled={rowPending} onClick={onEdit}>
                Edytuj
              </Button>
              <Link href={scheduleHref} className="ml-auto">
                <Button variant="ghost" size="sm">
                  Terminy
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <div
          className={sidePanelContentClass}
          {...{ [SCROLL_LOCK_ALLOW_ATTR]: "" }}
        >
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {TEETH_DUAL_LANE_COPY.dailyPanelScheduleCaption}
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <DateCard
              icon={<IconCalendar size={15} />}
              label="Ostatnie zamówienie"
              value={formatPlDate(supplier.order_date)}
            />
            <DateCard
              icon={<IconClock size={15} />}
              label="Planowane zamówienie"
              value={formatPlDate(supplier.computed_next_date)}
              emphasize
            />
          </div>

          {supplier.shift_date ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-100/70 px-3 py-1.5 text-xs text-slate-600">
              <span className="text-slate-400">Ręczne przesunięcie:</span>
              <span className="font-semibold tabular-nums text-slate-800">
                {formatPlDate(supplier.shift_date)}
              </span>
            </div>
          ) : null}

          {teethLane ? <TeethDualLaneNotice lane={teethLane} /> : null}

          {supplier.order_on_demand ? (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-violet-200/70 bg-violet-50/50 px-3.5 py-3 text-sm text-violet-900">
              <IconPackageCheck size={16} className="mt-0.5 shrink-0 text-violet-600" />
              <div>
                <span className="font-semibold">Tylko w razie potrzeby</span>
                <p className="mt-0.5 text-xs leading-relaxed text-violet-700">
                  Bez stałego terminu w planie tygodnia. Zamówienie z listy w panelu dziennym.
                </p>
              </div>
            </div>
          ) : null}

          <DrawerBlock title="Kontakt i zamówienia" icon={<IconMail size={13} />} className="mt-7">
            <div className="mb-3 flex flex-wrap items-center gap-2.5 rounded-lg border border-slate-200/70 bg-slate-50/50 px-3.5 py-3">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                  supplier.subiekt_kh_id != null
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-slate-200 text-slate-500"
                )}
              >
                {supplier.subiekt_kh_id != null ? <IconLink size={14} /> : <IconLinkOff size={14} />}
              </span>
              <div className="min-w-0 flex-1 text-sm">
                {supplier.subiekt_kh_id != null ? (
                  <p className="font-medium text-indigo-900">
                    Powiązany z Subiektem
                    <span className="ml-1 text-xs font-normal text-indigo-600">
                      kh_Id {supplier.subiekt_kh_id}
                    </span>
                  </p>
                ) : (
                  <p className="text-slate-600">
                    Brak powiązania z Subiektem
                  </p>
                )}
                <p className="mt-0.5 text-xs text-slate-400">
                  {supplier.subiekt_kh_id != null
                    ? "Auto-dostawca z ZD trafia poprawnie"
                    : "Auto-dostawca z ZD może nie trafić"}
                </p>
              </div>
              <Link href={cardsHref}>
                <Button variant="secondary" size="sm">
                  {supplier.subiekt_kh_id != null ? "Zmień" : "Powiąż"}
                </Button>
              </Link>
            </div>
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

          <DrawerBlock title="Harmonogram dostaw" icon={<IconCalendar size={13} />} className="mt-7">
            <dl className="grid grid-cols-2 gap-3">
              <Field
                label="Częstotliwość"
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

          <DrawerBlock title="Ostatnie akcje" icon={<IconClock size={13} />} className="mt-7">
            {historyLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="h-3 w-3 animate-pulse rounded-full bg-slate-300" />
                Ładowanie historii…
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-slate-400">Brak zapisów w historii.</p>
            ) : (
              <ol className="relative space-y-3 pl-4 before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                {history.map((h, i) => (
                  <li
                    key={`${h.action_at}-${i}`}
                    className="relative"
                  >
                    <span className="absolute -left-4 top-1.5 h-2.5 w-2.5 rounded-full bg-indigo-400 ring-2 ring-white" />
                    <p className="text-sm font-medium text-slate-800">{h.action}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                      <span className="tabular-nums">{formatPlDate(h.action_at.slice(0, 10))}</span>
                      <span className="text-slate-300">·</span>
                      <span>{h.user_email}</span>
                      {h.next_date ? (
                        <>
                          <span className="text-slate-300">→</span>
                          <span className="tabular-nums">{formatPlDate(h.next_date)}</span>
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </DrawerBlock>

          <DrawerBlock title="Odbiór towaru" icon={<IconTruck size={13} />} className="mt-7">
            <ul className="space-y-2 text-sm">
              {supplier.pickup_mikran ? (
                <li className="flex items-center gap-2.5 rounded-lg bg-slate-50/70 px-3 py-2 text-slate-700">
                  <IconTruck size={15} className="shrink-0 text-slate-400" />
                  Kierowca Mikran
                </li>
              ) : null}
              {supplier.pickup_pallet ? (
                <li className="flex items-center gap-2.5 rounded-lg bg-slate-50/70 px-3 py-2 text-slate-700">
                  <IconPackageCheck size={15} className="shrink-0 text-slate-400" />
                  Zlecenie odbioru palety
                </li>
              ) : null}
              {!supplier.pickup_mikran && !supplier.pickup_pallet ? (
                <li className="text-sm text-slate-400">Brak zleconego odbioru</li>
              ) : null}
            </ul>
          </DrawerBlock>
        </div>
      </aside>
    </>
  );
}

function DateCard({
  icon,
  label,
  value,
  emphasize,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5 transition-colors",
        emphasize
          ? "border-indigo-200/70 bg-indigo-50/40"
          : "border-slate-200/70 bg-white"
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn("shrink-0", emphasize ? "text-indigo-500" : "text-slate-400")}>
          {icon}
        </span>
        <p className={cn("text-xs", emphasize ? "text-indigo-600" : "text-slate-500")}>{label}</p>
      </div>
      <p
        className={cn(
          "mt-1 tabular-nums",
          emphasize
            ? "text-base font-semibold text-slate-900"
            : "text-sm font-medium text-slate-700"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function DrawerBlock({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-3 flex items-center gap-1.5">
        {icon ? <span className="text-slate-400">{icon}</span> : null}
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50/60 px-3 py-2.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
