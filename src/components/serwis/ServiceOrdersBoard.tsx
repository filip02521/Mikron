"use client";

import { useAdminPanelPreview } from "@/components/layout/AdminPanelPreviewContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Kbd } from "@/components/ui/Kbd";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { IconChevronRight, IconPlus, IconSearch } from "@/components/icons/StrokeIcons";
import { useAppRole } from "@/components/layout/AppRoleContext";
import { cn } from "@/lib/cn";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { isSerwis } from "@/lib/auth-roles";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import { ServiceOrderDrawer } from "@/components/serwis/ServiceOrderDrawer";
import { ServiceOrderIntakeDialog } from "@/components/serwis/ServiceOrderIntakeDialog";
import { HelpdeskTicketsSection, type HelpdeskBoardData } from "@/components/serwis/HelpdeskTicketsSection";
import { countTicketsWithoutOrders, helpdeskSearchText } from "@/components/serwis/helpdesk-intake";
import { ServiceStampStrip, stampSummary } from "@/components/serwis/ServiceStampStrip";
import { ServiceFilterBar } from "@/components/serwis/ServiceFilterBar";
import {
  daysSince,
  formatDateOnly,
  formatLocalDate,
  OrderStatusPill,
  orderSearchText,
  type LinkableLoaner,
  type ModelPartView,
  type OrderPartView,
} from "@/components/serwis/service-order-view";
import { formatQuoteAmount, waitingPartArrived, type ServiceOrder, type ServiceOrderEvent } from "@/lib/orders/service-orders";
import {
  SERVICE_BOARD_LANE_LABEL,
  SERVICE_BOARD_LANES,
  serviceOrderLane,
  serviceOrderNowReason,
  serviceOrderStamps,
  quoteWaitingDays,
  type ServiceBoardLane,
  type ServiceNowReason,
} from "@/lib/orders/service-order-board";

const noopSubscribe = () => () => {};

type TileLane = Exclude<ServiceBoardLane, "zamkniete">;

// Filtry w kolejności grup pod nimi; kropka = stan grupy (tabela Stany), fiolet zostaje dla akcji i pieczątek.
// „Teraz” łączy dwa stany (część dotarła — zieleń, termin minął — czerwień), więc kropki nie ma; stan mówi odznaka w wierszu.
const TILES: { id: TileLane; dot?: string; hint: string }[] = [
  { id: "teraz", hint: "Część dotarła albo termin minął" },
  { id: "do_wydania", dot: "bg-emerald-600", hint: "Gotowe — zadzwoń i wydaj" },
  { id: "klient", dot: "bg-amber-500", hint: "Wycena zapisana — czeka na decyzję klienta" },
  { id: "w_naprawie", dot: "bg-slate-400", hint: "Przyjęte, diagnoza, naprawa" },
  { id: "czeka", dot: "bg-amber-500", hint: "Naprawa stoi na części" },
  { id: "dokumenty", dot: "bg-red-600", hint: "Wydane bez faktury lub RW" },
];

/** Zdanie stanu nad tablicą: najpierw to, co czeka na ruch serwisanta; nazwy jak w grupach pod spodem. */
function boardStateSentence(counts: Record<ServiceBoardLane, number>, tickets: number): string {
  const parts: string[] = [];
  if (counts.teraz) parts.push(`${counts.teraz} do ruchu teraz`);
  if (counts.do_wydania) parts.push(`${counts.do_wydania} do wydania`);
  if (tickets) parts.push(`${tickets} ${polishPluralWord(tickets, "zgłoszenie", "zgłoszenia", "zgłoszeń")} do przyjęcia`);
  if (counts.klient) parts.push(`${counts.klient} czeka na klienta`);
  if (counts.dokumenty) parts.push(`${counts.dokumenty} bez dokumentów`);
  if (!parts.length) parts.push("Nic pilnego");
  // Te same słowa i liczby co filtry pod zdaniem.
  if (counts.w_naprawie) parts.push(`${counts.w_naprawie} w naprawie`);
  if (counts.czeka) parts.push(`${counts.czeka} czeka na część`);
  return parts.join(" · ");
}

function NowReasonPill({ reason, dueDate, quoteDays }: { reason: ServiceNowReason; dueDate: string | null; quoteDays: number | null }) {
  if (reason === "klient") {
    return (
      <span className="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-50 px-2.5 text-xs font-medium text-amber-900">
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
        Klient milczy {quoteDays ?? 0} {polishPluralWord(quoteDays ?? 0, "dzień", "dni", "dni")} po wycenie
      </span>
    );
  }
  return reason === "czesc" ? (
    <span className="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 text-xs font-medium text-emerald-800">
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      Część na stanie — wznów
    </span>
  ) : (
    <span className="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full bg-red-50 px-2.5 text-xs font-medium text-red-800">
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      Termin minął{dueDate ? ` ${formatDateOnly(dueDate).slice(0, 5)}` : ""}
    </span>
  );
}

function OrderRow({
  order,
  events,
  partsCount,
  today,
  reason,
  onOpen,
}: {
  order: ServiceOrder;
  events: ServiceOrderEvent[];
  partsCount: number;
  today: Date;
  reason: ServiceNowReason | null;
  onOpen: () => void;
}) {
  const stamps = useMemo(() => serviceOrderStamps(order, events), [order, events]);
  const days = daysSince(order.createdAt, today);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "group flex w-full flex-col gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-[var(--sv-box)] md:flex-row md:items-center md:gap-5 md:px-5",
          controlFocusClass
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-xs font-semibold text-slate-500">{order.number}</span>
            <span className="text-[0.9375rem] font-semibold text-slate-900">{order.deviceName}</span>
          </span>
          <span className="text-[0.8125rem] text-slate-500">
            {order.clientName}
            {order.serialNo ? (
              <>
                {" · "}
                <span className="whitespace-nowrap">SN {order.serialNo}</span>
              </>
            ) : null}
            {partsCount ? ` · ${partsCount} ${polishPluralWord(partsCount, "część", "części", "części")}` : ""}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {reason ? <NowReasonPill reason={reason} dueDate={order.dueDate} quoteDays={quoteWaitingDays(order.quote.sentAt, today)} /> : null}
            {order.status === "czeka_na_akceptacje" && order.quote.amount != null && reason !== "klient" ? (
              <span className="whitespace-nowrap text-[0.8125rem] tabular-nums text-amber-900">wycena {formatQuoteAmount(order.quote.amount)}</span>
            ) : null}
            {order.status === "anulowane" ? <OrderStatusPill status="anulowane" /> : null}
            <span className="whitespace-nowrap text-[0.8125rem] tabular-nums text-slate-500">
              {order.closedAt
                ? `zamknięte ${formatLocalDate(order.closedAt)}`
                : `${days} ${polishPluralWord(days, "dzień", "dni", "dni")} w serwisie`}
              {order.dueDate && !order.closedAt && reason !== "termin" ? ` · termin ${formatDateOnly(order.dueDate)}` : ""}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-3">
          <ServiceStampStrip stamps={stamps} cancelled={order.status === "anulowane"} />
          <span className="sr-only">{stampSummary(stamps)}</span>
          <IconChevronRight size={18} className="hidden text-slate-400 transition-transform duration-150 group-hover:translate-x-0.5 md:block" aria-hidden />
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
  warrantyMonths: warrantyPairs,
  partAvailable: partAvailablePairs,
  helpdesk,
}: {
  orders: ServiceOrder[];
  parts: OrderPartView[];
  events: ServiceOrderEvent[];
  loaners: LinkableLoaner[];
  modelParts: ModelPartView[];
  /** Okresy gwarancji modeli różne od domyślnego: [tw_Id, miesiące]. */
  warrantyMonths: [number, number][];
  /** Ile części, na które czekają zlecenia, jest do wzięcia: [tw_Id, szt.]; brak wpisu — Subiekt nie odpowiedział. */
  partAvailable: [number, number][];
  /** Zgłoszenia helpdesku mikran.pl czekające na sprzęt. */
  helpdesk: HelpdeskBoardData;
}) {
  const role = useAppRole();
  // Serwisant ma „Przyjmij sprzęt” w pasie Serwisu; inne role (zakupy, magazyn) — tutaj.
  const intakeInBar = !!role && isSerwis(role);
  const warrantyMonths = useMemo(() => new Map(warrantyPairs), [warrantyPairs]);
  const partAvailable = useMemo(() => new Map(partAvailablePairs), [partAvailablePairs]);
  const router = useRouter();
  const params = useSearchParams();
  const [, startRefresh] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TileLane | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  // Podgląd admina „Serwis” jest tylko do odczytu — bez przyjmowania sprzętu.
  const { readOnly } = useAdminPanelPreview();
  const [intake, setIntake] = useState(() => !readOnly && params.get("przyjmij") === "1");
  const [intakeHelpdeskId, setIntakeHelpdeskId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<string | null>(() => params.get("zlecenie"));
  const [toast, setToast] = useState<string | null>(null);
  // Portal panelu tylko po stronie klienta (zlecenie może się otworzyć od razu z ?zlecenie=).
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const today = useMemo(() => new Date(), []);

  // „Przyjmij sprzęt” z pasu Serwisu (?przyjmij=1) — także wtedy, gdy tablica jest już otwarta.
  const wantsIntake = params.get("przyjmij") === "1";
  const [seenWantsIntake, setSeenWantsIntake] = useState(wantsIntake);
  if (wantsIntake !== seenWantsIntake) {
    setSeenWantsIntake(wantsIntake);
    if (wantsIntake && !readOnly) {
      setIntakeHelpdeskId(null);
      setIntake(true);
    }
  }
  useEffect(() => {
    // Parametr działa raz: odświeżenie strony nie otwiera przyjęcia ponownie.
    if (wantsIntake) window.history.replaceState(null, "", window.location.pathname);
  }, [wantsIntake]);

  const partsByOrder = useMemo(() => {
    const m = new Map<string, OrderPartView[]>();
    for (const p of parts) m.set(p.orderId, [...(m.get(p.orderId) ?? []), p]);
    return m;
  }, [parts]);

  const eventsByOrder = useMemo(() => {
    const m = new Map<string, ServiceOrderEvent[]>();
    for (const e of events) m.set(e.orderId, [...(m.get(e.orderId) ?? []), e]);
    return m;
  }, [events]);

  const ctxOf = useMemo(
    () => (o: ServiceOrder) => ({ arrived: waitingPartArrived(o, partAvailable), today }),
    [partAvailable, today]
  );

  const lanes = useMemo(() => {
    const out = new Map<ServiceBoardLane, ServiceOrder[]>();
    for (const o of orders) {
      const lane = serviceOrderLane(o, partsByOrder.get(o.id) ?? [], ctxOf(o));
      out.set(lane, [...(out.get(lane) ?? []), o]);
    }
    // „Teraz”: najpierw zlecenia, których część dotarła (od razu do roboty), potem po terminie.
    const now = out.get("teraz");
    if (now) out.set("teraz", [...now].sort((a, b) => Number(!ctxOf(a).arrived) - Number(!ctxOf(b).arrived)));
    return out;
  }, [orders, partsByOrder, ctxOf]);

  // Liczniki kafli bez szukania — to stan całego serwisu, nie wynik wyszukiwania.
  const counts = useMemo(() => {
    const c = Object.fromEntries(SERVICE_BOARD_LANES.map((l) => [l, 0])) as Record<ServiceBoardLane, number>;
    for (const [lane, list] of lanes) c[lane] = list.length;
    return c;
  }, [lanes]);

  const words = query.trim().toLocaleLowerCase("pl-PL").split(/\s+/).filter(Boolean);
  const matches = (hay: string) => words.every((w) => hay.includes(w));
  const tickets = helpdesk.tickets.filter((t) => matches(helpdeskSearchText(t, helpdesk.linked[t.id])));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable=true]");
      if (typing || e.metaKey || e.ctrlKey || e.altKey || openId || intake) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        setIntakeHelpdeskId(null);
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

  const openIntake = (helpdeskId: number | null) => {
    setIntakeHelpdeskId(helpdeskId);
    setIntake(true);
  };

  const open = orders.find((o) => o.id === openId) ?? null;
  const visibleLanes = SERVICE_BOARD_LANES.filter((l) => (filter ? l === filter : true));
  const shownCount = (lane: ServiceBoardLane) => (lanes.get(lane) ?? []).filter((o) => matches(orderSearchText(o))).length;
  const nothingShown = visibleLanes.every((l) => shownCount(l) === 0) && (filter || tickets.length === 0);

  const renderLane = (lane: ServiceBoardLane) => {
    const list = (lanes.get(lane) ?? []).filter((o) => matches(orderSearchText(o)));
    if (!list.length) return null;
    const collapsible = lane === "zamkniete" && !filter && !query;
    const expanded = !collapsible || showClosed;
    const header = (
      <h2 id={`lane-${lane}`} className="text-[0.9375rem] font-semibold text-slate-900">
        {SERVICE_BOARD_LANE_LABEL[lane]} <span className="font-normal text-slate-500">· {list.length}</span>
      </h2>
    );
    return (
      <section key={lane} aria-labelledby={`lane-${lane}`} className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--sv-rule)] bg-card shadow-sm">
        {collapsible ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setShowClosed((v) => !v)}
            className={cn("flex min-h-11 w-full items-center gap-2 px-4 py-3 text-left transition-colors duration-150 hover:bg-[var(--sv-box)] md:px-5", controlFocusClass)}
          >
            <IconChevronRight size={16} className={cn("text-slate-500 transition-transform duration-150", expanded && "rotate-90")} aria-hidden />
            {header}
          </button>
        ) : (
          <div className="border-b border-[var(--sv-rule)] px-4 py-3 md:px-5">{header}</div>
        )}
        {expanded ? (
          <ul className={cn("divide-y divide-[var(--sv-rule)]", collapsible && "border-t border-[var(--sv-rule)]")}>
            {list.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                events={eventsByOrder.get(o.id) ?? []}
                partsCount={partsByOrder.get(o.id)?.length ?? 0}
                today={today}
                reason={lane === "teraz" ? serviceOrderNowReason(o, ctxOf(o)) : null}
                onOpen={() => setOpenId(o.id)}
              />
            ))}
          </ul>
        ) : null}
      </section>
    );
  };

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
            placeholder="Numer ZS, klient, SN, zgłoszenie"
            className="h-11 w-full rounded-lg border border-slate-200 bg-card pl-9 pr-10 text-base shadow-[var(--shadow-control)] transition-colors duration-150 hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 sm:block">
            <Kbd>/</Kbd>
          </span>
        </label>
        {intakeInBar || readOnly ? null : (
          <Button type="button" className="w-full sm:ml-auto sm:w-auto" onClick={() => openIntake(null)}>
            <IconPlus size={18} aria-hidden />
            Przyjmij sprzęt
          </Button>
        )}
      </div>

      {orders.length === 0 && helpdesk.tickets.length === 0 ? (
        <EmptyState
          title="Brak zleceń serwisowych"
          description="Przyjmij pierwszy sprzęt klienta: zlecenie dostanie numer ZS, a każdy krok naprawy przybije pieczątkę na jego karcie."
          action={readOnly ? undefined : <Button onClick={() => openIntake(null)}>Przyjmij sprzęt</Button>}
        />
      ) : (
        <>
          <p className="font-display text-lg font-bold tracking-[-0.01em] text-slate-900" aria-live="polite">
            {/* Zgłoszenia bez żadnego przyjętego sprzętu — ta sama liczba co w nagłówku sekcji helpdesku. */}
            {boardStateSentence(counts, countTicketsWithoutOrders(helpdesk.tickets, helpdesk.linked))}
          </p>
          <ServiceFilterBar
            label="Filtr zleceń"
            className="-mt-3"
            value={filter}
            onChange={setFilter}
            options={TILES.map((t) => ({ id: t.id, label: SERVICE_BOARD_LANE_LABEL[t.id], count: counts[t.id], dot: t.dot, hint: t.hint }))}
          />

          {nothingShown ? (
            <EmptyState
              title={query ? "Nic nie pasuje do szukania" : `Brak zleceń: ${filter ? SERVICE_BOARD_LANE_LABEL[filter].toLowerCase() : ""}`}
              description={query ? "Sprawdź numer ZS, nazwę klienta, numer seryjny albo numer zgłoszenia." : "Kliknij kafel jeszcze raz, żeby zobaczyć wszystkie zlecenia."}
            />
          ) : (
            <div className="space-y-5">
              {/* Najpierw to, co serwisant robi dziś (teraz, do wydania), potem sprzęt, który dopiero przyjdzie. */}
              {visibleLanes.filter((l) => l === "teraz" || l === "do_wydania").map(renderLane)}
              {!filter ? <HelpdeskTicketsSection data={helpdesk} tickets={tickets} onAccept={readOnly ? undefined : (id) => openIntake(id)} /> : null}
              {visibleLanes.filter((l) => l !== "teraz" && l !== "do_wydania").map(renderLane)}
            </div>
          )}
        </>
      )}

      {/* Okno tylko po stronie klienta: otwarte z ?przyjmij=1 nie może się renderować na serwerze (inne useId → błąd hydracji). */}
      {intake && mounted ? (
        <ServiceOrderIntakeDialog
          warrantyMonths={warrantyMonths}
          helpdeskEnabled={helpdesk.mode !== "off"}
          initialHelpdeskId={intakeHelpdeskId}
          tickets={helpdesk.tickets}
          linked={helpdesk.linked}
          onOpenOrder={(id) => {
            setIntake(false);
            setOpenId(id);
          }}
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
              events={eventsByOrder.get(open.id) ?? []}
              // Egzemplarz powiązany z innym zleceniem nie jest do wyboru (serwer też tego pilnuje).
              loaners={loaners.filter((l) => !orders.some((o) => o.id !== open.id && o.loanerUnitId === l.id))}
              modelParts={modelParts}
              waitingPartAvailable={open.waitingPart?.twId != null ? partAvailable.get(open.waitingPart.twId) ?? null : null}
              // Tablica ma zlecenia otwarte i niedawno zamknięte — starsze z historii egzemplarza są tylko do przeczytania.
              canOpenOrder={(id) => orders.some((o) => o.id === id)}
              onOpenOrder={setOpenId}
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
