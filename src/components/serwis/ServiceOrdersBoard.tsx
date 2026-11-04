"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Kbd } from "@/components/ui/Kbd";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { IconPlus, IconSearch } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import { ServiceOrderDrawer } from "@/components/serwis/ServiceOrderDrawer";
import { ServiceOrderIntakeDialog } from "@/components/serwis/ServiceOrderIntakeDialog";
import {
  daysSince,
  formatDateOnly,
  ORDER_GROUP_LABEL,
  OrderStatusPill,
  orderSearchText,
  type LinkableLoaner,
  type ModelPartView,
  type OrderPartView,
} from "@/components/serwis/service-order-view";
import {
  isServiceOrderLate,
  serviceOrderGroup,
  type ServiceOrder,
  type ServiceOrderEvent,
  type ServiceOrderGroup,
} from "@/lib/orders/service-orders";

/** Kolejność grup: najpierw to, co stoi, potem praca w toku, wydanie, papiery, archiwum. */
const noopSubscribe = () => () => {};

const GROUP_ORDER: ServiceOrderGroup[] = ["czeka_na_czesc", "w_serwisie", "gotowe", "dokumenty", "zamkniete"];

const TILES: { id: Exclude<ServiceOrderGroup, "zamkniete">; tone: string }[] = [
  { id: "w_serwisie", tone: "bg-indigo-600" },
  { id: "czeka_na_czesc", tone: "bg-amber-500" },
  { id: "gotowe", tone: "bg-emerald-500" },
  { id: "dokumenty", tone: "bg-red-500" },
];

const TILE_HINT: Record<Exclude<ServiceOrderGroup, "zamkniete">, string> = {
  w_serwisie: "Przyjęte, diagnoza, naprawa",
  czeka_na_czesc: "Naprawa stoi — brakuje części",
  gotowe: "Do odbioru przez klienta",
  dokumenty: "Zamknięte bez faktury lub RW",
};

function OrderRow({ order, partsCount, today, onOpen }: { order: ServiceOrder; partsCount: number; today: Date; onOpen: () => void }) {
  const late = isServiceOrderLate(order, today);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors duration-150 hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-4 sm:px-5",
          controlFocusClass
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-xs font-semibold text-slate-500">{order.number}</span>
            <span className="text-[0.9375rem] font-semibold text-slate-900">{order.deviceName}</span>
          </span>
          <span className="text-[0.8125rem] text-slate-500">
            {order.clientName}
            {order.serialNo ? ` · SN ${order.serialNo}` : ""}
            {partsCount ? ` · ${partsCount} ${partsCount === 1 ? "część" : "części"}` : ""}
          </span>
        </span>
        <span className="flex flex-none flex-wrap items-center gap-x-3 gap-y-1 sm:justify-end">
          <OrderStatusPill status={order.status} />
          <span className="whitespace-nowrap text-[0.8125rem] tabular-nums text-slate-500">
            {order.closedAt ? `zamknięte ${formatDateOnly(order.closedAt.slice(0, 10))}` : `${daysSince(order.createdAt, today)} dni`}
          </span>
          {order.dueDate && !order.closedAt ? (
            <span className={cn("whitespace-nowrap text-[0.8125rem] tabular-nums", late ? "font-semibold text-red-700" : "text-slate-500")}>
              {late ? "termin minął " : "termin "}
              {formatDateOnly(order.dueDate)}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

export function ServiceOrdersBoard({
  orders,
  parts,
  events,
  loaners,
  modelParts,
}: {
  orders: ServiceOrder[];
  parts: OrderPartView[];
  events: ServiceOrderEvent[];
  loaners: LinkableLoaner[];
  modelParts: ModelPartView[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startRefresh] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ServiceOrderGroup | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [intake, setIntake] = useState(false);
  const [openId, setOpenId] = useState<string | null>(() => params.get("zlecenie"));
  const [toast, setToast] = useState<string | null>(null);
  // Portal panelu tylko po stronie klienta (zlecenie może się otworzyć od razu z ?zlecenie=).
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const today = useMemo(() => new Date(), []);

  const partsByOrder = useMemo(() => {
    const m = new Map<string, OrderPartView[]>();
    for (const p of parts) m.set(p.orderId, [...(m.get(p.orderId) ?? []), p]);
    return m;
  }, [parts]);

  const grouped = useMemo(() => {
    // Jak w częściach serwisowych: każde słowo gdziekolwiek („forte gabinet” znajdzie zlecenie).
    const words = query.trim().toLocaleLowerCase("pl-PL").split(/\s+/).filter(Boolean);
    const out = new Map<ServiceOrderGroup, ServiceOrder[]>();
    for (const o of orders) {
      const hay = orderSearchText(o);
      if (words.length && !words.every((w) => hay.includes(w))) continue;
      const g = serviceOrderGroup(o, partsByOrder.get(o.id) ?? []);
      out.set(g, [...(out.get(g) ?? []), o]);
    }
    return out;
  }, [orders, partsByOrder, query]);

  // Liczniki kafli bez szukania — to stan całego serwisu, nie wynik wyszukiwania.
  const counts = useMemo(() => {
    const c: Record<ServiceOrderGroup, number> = { czeka_na_czesc: 0, w_serwisie: 0, gotowe: 0, dokumenty: 0, zamkniete: 0 };
    for (const o of orders) c[serviceOrderGroup(o, partsByOrder.get(o.id) ?? [])]++;
    return c;
  }, [orders, partsByOrder]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable=true]");
      if (typing || e.metaKey || e.ctrlKey || e.altKey || openId || intake) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        setIntake(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, intake]);

  const done = (message: string) => {
    setToast(message);
    startRefresh(() => router.refresh());
  };

  const open = orders.find((o) => o.id === openId) ?? null;
  const visibleGroups = GROUP_ORDER.filter((g) => (filter ? g === filter : true)).filter((g) => (grouped.get(g)?.length ?? 0) > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative block w-full min-w-0 sm:w-auto sm:max-w-sm sm:flex-1">
          <span className="sr-only">Szukaj zlecenia</span>
          <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Numer ZS, klient, sprzęt, SN, RW"
            className="h-11 w-full rounded-lg border border-slate-200 bg-card pl-9 pr-10 text-base shadow-[var(--shadow-control)] transition-colors duration-150 hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:h-10 sm:text-sm"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 sm:block">
            <Kbd>/</Kbd>
          </span>
        </label>
        <Button type="button" className="w-full sm:ml-auto sm:w-auto" onClick={() => setIntake(true)}>
          <IconPlus size={18} aria-hidden />
          Przyjmij sprzęt
        </Button>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="Brak zleceń serwisowych"
          description="Przyjmij pierwszy sprzęt klienta: zlecenie dostanie numer ZS, a naprawę, części i RW poprowadzisz w jego panelu."
          action={<Button onClick={() => setIntake(true)}>Przyjmij sprzęt</Button>}
        />
      ) : (
        <>
          <div role="group" aria-label="Filtr zleceń" className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {TILES.map((t) => {
              const active = filter === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(active ? null : t.id)}
                  className={cn(
                    "flex min-w-0 flex-col items-start rounded-lg border bg-card px-3 py-2.5 text-left shadow-sm transition-colors duration-150 sm:px-4 sm:py-3",
                    controlFocusClass,
                    active ? "border-indigo-600 ring-1 ring-inset ring-indigo-600" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", t.tone)} aria-hidden />
                    <span className="text-2xl font-semibold leading-none tabular-nums text-slate-900 sm:text-[1.75rem]">{counts[t.id]}</span>
                  </span>
                  <span className={cn("mt-1.5 text-sm font-semibold", active ? "text-indigo-800" : "text-slate-800")}>{ORDER_GROUP_LABEL[t.id]}</span>
                  <span className="mt-0.5 hidden text-[0.8125rem] text-slate-500 sm:block">{TILE_HINT[t.id]}</span>
                </button>
              );
            })}
          </div>

          {visibleGroups.length === 0 ? (
            <EmptyState
              title={query ? "Nic nie pasuje do szukania" : `Brak zleceń: ${filter ? ORDER_GROUP_LABEL[filter].toLowerCase() : ""}`}
              description={query ? "Sprawdź numer ZS, nazwę klienta albo numer seryjny." : "Kliknij kafel jeszcze raz, żeby zobaczyć wszystkie zlecenia."}
            />
          ) : (
            <div className="space-y-5">
              {visibleGroups.map((g) => {
                const list = grouped.get(g) ?? [];
                const collapsible = g === "zamkniete" && !filter && !query;
                const expanded = !collapsible || showClosed;
                return (
                  <section key={g} aria-labelledby={`grp-${g}`} className="overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm">
                    {collapsible ? (
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setShowClosed((v) => !v)}
                        className={cn("flex w-full items-center gap-2 px-4 py-3 text-left transition-colors duration-150 hover:bg-slate-50 sm:px-5", controlFocusClass)}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                          className={cn("text-slate-500 transition-transform duration-150", expanded && "rotate-90")}
                        >
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                        <h2 id={`grp-${g}`} className="text-[0.9375rem] font-semibold text-slate-900">
                          {ORDER_GROUP_LABEL[g]} <span className="font-normal text-slate-500">· {list.length}</span>
                        </h2>
                      </button>
                    ) : (
                      <h2 id={`grp-${g}`} className="border-b border-slate-100 px-4 py-3 text-[0.9375rem] font-semibold text-slate-900 sm:px-5">
                        {ORDER_GROUP_LABEL[g]} <span className="font-normal text-slate-500">· {list.length}</span>
                      </h2>
                    )}
                    {expanded ? (
                      <ul className={cn("divide-y divide-slate-100", collapsible && "border-t border-slate-100")}>
                        {list.map((o) => (
                          <OrderRow key={o.id} order={o} partsCount={partsByOrder.get(o.id)?.length ?? 0} today={today} onOpen={() => setOpenId(o.id)} />
                        ))}
                      </ul>
                    ) : null}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      {intake ? (
        <ServiceOrderIntakeDialog
          onClose={() => setIntake(false)}
          onCreated={(message, orderId) => {
            setIntake(false);
            done(message);
            if (orderId) setOpenId(orderId);
          }}
        />
      ) : null}

      {mounted && open
        ? createPortal(
            <ServiceOrderDrawer
              key={open.id}
              order={open}
              parts={partsByOrder.get(open.id) ?? []}
              events={events.filter((e) => e.orderId === open.id)}
              // Egzemplarz powiązany z innym zleceniem nie jest do wyboru (serwer też tego pilnuje).
              loaners={loaners.filter((l) => !orders.some((o) => o.id !== open.id && o.loanerUnitId === l.id))}
              modelParts={modelParts}
              today={today}
              onClose={() => {
                setOpenId(null);
                // Link ?zlecenie= otwiera panel raz — po zamknięciu odświeżenie strony nie otwiera go ponownie.
                if (params.get("zlecenie")) window.history.replaceState(null, "", window.location.pathname);
              }}
              onDone={done}
            />,
            document.body
          )
        : null}
      {toast ? <NoticeToast notice={toast} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}
