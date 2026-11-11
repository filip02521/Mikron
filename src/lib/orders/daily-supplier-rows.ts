// Czysty moduł (bez bazy, bez Reacta) — panel dzienny: jeden wiersz na dostawcę.
// Reguły grup: docs/plans/panel-dzienny-lista-dostawcow.md → „Reguły grup”.

import type { ZdAutoProposal } from "@/lib/data/zd-auto-proposals";
import { formatDateString } from "@/lib/orders/dates";
import type { SummaryStandardItem } from "@/lib/orders/summary";
import type { OnDemandSupplierRow, SummaryForSomeoneEnriched } from "@/lib/orders/summary-workspace";
import { STAGE_RANK, daysBetweenKeys, type ZdAutomatTodayOrder } from "@/lib/orders/zd-automat-daily";
import type { StockWatchOffPlanSupplier } from "@/lib/stock-watch/data";
import {
  stockSignalHasWork,
  stockWatchPrepareZdUsesHorizon,
  stockWatchSignalStale,
  type StockWatchSupplierSignal,
} from "@/lib/stock-watch/signal";

export type DailySupplierSource = "automat" | "harmonogram" | "poza-planem" | "na-zadanie";
export type DailySupplierGroup = "send" | "order" | "early" | "shift" | "manual" | "done";
export type DailySupplierAction =
  | { kind: "automat"; label: "Sprawdź i wyślij" | "Sprawdź" | "Wyślij mail" }
  | { kind: "prepareZd"; horizon: boolean }
  | { kind: "braki" }
  | { kind: "shift" }
  | { kind: "ordered" };

/** Czekająca propozycja automatu z nazwą dostawcy (to samo co `DailyZdProposal` w komponencie). */
export type DailySupplierPendingProposal = ZdAutoProposal & { supplierName: string };

export type DailySupplierRow = {
  supplierId: string;
  supplierName: string;
  group: DailySupplierGroup;
  /** Kolejność = pierwszeństwo etykiety: automat, harmonogram, poza-planem, na-zadanie. */
  sources: DailySupplierSource[];
  /** null w grupie „done” i dla etapu „send” bez utworzonego ZD. */
  action: DailySupplierAction | null;
  schedule: SummaryStandardItem | null;
  /** 0 = termin dziś albo brak terminu. */
  overdueDays: number;
  automatOrder: ZdAutomatTodayOrder | null;
  pendingProposal: DailySupplierPendingProposal | null;
  automatWarning: boolean;
  vacationNote: string | null;
  onVacationNow: boolean;
  signal: StockWatchSupplierSignal | null;
  signalStale: boolean;
  offPlanCount: number;
  offPlanNextOrderDate: string | null;
  /** ZD z Kreatora powstało albo zostało powiązane dziś — stąd „Zrobione dziś” mimo nocnej analizy. */
  zdToday: boolean;
  /** Pozycje próśb handlowców u tego dostawcy. */
  requestCount: number;
  /** Pozycje sygnałów „brak na stanie” u tego dostawcy (osobna sekcja panelu). */
  stockOutCount: number;
};

export type DailySupplierRowsInput = {
  todayDateKey: string;
  nowIso: string;
  scheduled: readonly SummaryStandardItem[];
  /** `zdAutomatTodayOrders(...).orders` — może być kilka na dostawcę. */
  automatOrders: readonly ZdAutomatTodayOrder[];
  pendingProposals: readonly DailySupplierPendingProposal[];
  /** Dostawcy w automacie (`zdAutomat.suppliers`) — ich propozycje są już w `automatOrders`. */
  automatSupplierIds: ReadonlySet<string>;
  vacationNowIds: ReadonlySet<string>;
  signals: Readonly<Record<string, StockWatchSupplierSignal>>;
  offPlan: readonly StockWatchOffPlanSupplier[];
  onDemand: readonly OnDemandSupplierRow[];
  requestGroups: readonly Pick<SummaryForSomeoneEnriched, "supplierId" | "lines">[];
  stockOutGroups: readonly Pick<SummaryForSomeoneEnriched, "supplierId" | "lines">[];
  /** Dostawcy z ZD z Kreatora utworzonym albo powiązanym dziś. */
  zdTodaySupplierIds: ReadonlySet<string>;
  canPrepareZd: boolean;
};

export const DAILY_SUPPLIER_GROUP_ORDER: readonly DailySupplierGroup[] = ["send", "order", "early", "shift", "manual", "done"];

export const DAILY_SUPPLIER_GROUP_LABEL: Record<DailySupplierGroup, string> = {
  send: "Do wysłania",
  order: "Do zamówienia",
  early: "Zamów wcześniej",
  shift: "Do przesunięcia",
  manual: "Do sprawdzenia ręcznie",
  done: "Zrobione dziś",
};

export const DAILY_SUPPLIER_SOURCE_ORDER: readonly DailySupplierSource[] = ["automat", "harmonogram", "poza-planem", "na-zadanie"];

export const DAILY_SUPPLIER_SOURCE_LABEL: Record<DailySupplierSource, string> = {
  automat: "Automat",
  harmonogram: "Harmonogram",
  "poza-planem": "Poza planem",
  "na-zadanie": "Na żądanie",
};

export function parseDailySupplierSource(raw: string | null): DailySupplierSource | null {
  return DAILY_SUPPLIER_SOURCE_ORDER.find((s) => s === raw) ?? null;
}

/** Bezpieczniki automatu widoczne przed otwarciem panelu: oflagowane pozycje albo nietypowo wysoka wartość. */
export function zdProposalHasWarning(p: Pick<ZdAutoProposal, "lines" | "flags">): boolean {
  return p.flags.includes("order_value_jump") || p.lines.some((l) => (l.flags?.length ?? 0) > 0);
}

const AUTOMAT_LABEL = { review: "Sprawdź i wyślij", unconfirmed: "Sprawdź", send: "Wyślij mail" } as const;

export function buildDailySupplierRows(input: DailySupplierRowsInput): DailySupplierRow[] {
  const now = Date.parse(input.nowIso);
  const scheduleById = new Map(input.scheduled.map((i) => [i.supplierId, i]));
  const offPlanById = new Map(input.offPlan.map((o) => [o.supplierId, o]));
  const onDemandById = new Map(input.onDemand.map((o) => [o.supplierId, o]));
  const pendingById = new Map(input.pendingProposals.map((p) => [p.supplierId, p]));
  // Kilka zamówień u dostawcy (wysłane dziś + nowe czekające) — wiersz bierze to, które czeka na decyzję.
  const orderById = new Map<string, ZdAutomatTodayOrder>();
  for (const o of input.automatOrders) {
    const prev = orderById.get(o.supplierId);
    if (!prev || STAGE_RANK[o.stage] < STAGE_RANK[prev.stage]) orderById.set(o.supplierId, o);
  }
  const countLines = (groups: DailySupplierRowsInput["requestGroups"]) => {
    const map = new Map<string, number>();
    for (const g of groups) map.set(g.supplierId, (map.get(g.supplierId) ?? 0) + g.lines.length);
    return map;
  };
  const requestCountById = countLines(input.requestGroups);
  const stockOutCountById = countLines(input.stockOutGroups);

  const ids = new Set<string>([...scheduleById.keys(), ...orderById.keys(), ...pendingById.keys(), ...offPlanById.keys(), ...onDemandById.keys()]);
  const rows: DailySupplierRow[] = [];

  for (const id of ids) {
    const schedule = scheduleById.get(id) ?? null;
    const offPlan = offPlanById.get(id) ?? null;
    const anyOrder = orderById.get(id) ?? null;
    // Odrzucone dziś nie jest ani pracą, ani „zrobione” — wiersz idzie regułami analizy.
    const order = anyOrder && anyOrder.stage !== "rejected" ? anyOrder : null;
    const pending = pendingById.get(id) ?? null;
    const classicPending = !order && pending && !input.automatSupplierIds.has(id) ? pending : null;
    const signal = input.signals[id] ?? null;
    const work = signal != null && stockSignalHasWork(signal);
    const stale = signal != null && stockWatchSignalStale(signal.computedAt, now);
    const isOnDemand = onDemandById.has(id) || offPlan?.onDemand === true;
    const requestCount = requestCountById.get(id) ?? 0;
    const stockOutCount = stockOutCountById.get(id) ?? 0;
    const zdToday = input.zdTodaySupplierIds.has(id);
    const prepare = (horizon: boolean): DailySupplierAction =>
      input.canPrepareZd ? { kind: "prepareZd", horizon } : { kind: "braki" };
    const horizon = offPlan != null || (signal != null && stockWatchPrepareZdUsesHorizon(signal));

    let group: DailySupplierGroup;
    let action: DailySupplierAction | null;
    if (order && order.stage !== "sent") {
      group = "send";
      const label = AUTOMAT_LABEL[order.stage as keyof typeof AUTOMAT_LABEL];
      action = order.stage === "send" && !order.proposal.dokId ? null : { kind: "automat", label };
    } else if (classicPending) {
      group = "send";
      action = { kind: "automat", label: "Sprawdź i wyślij" };
    } else if (order) {
      // Wysłane dziś wygrywa z nocną analizą, która o tym zamówieniu nie wie (ryzyko podwójnego ZD).
      group = "done";
      action = null;
    } else if ((schedule || isOnDemand) && (work || offPlan || (schedule && requestCount + stockOutCount > 0))) {
      // ZD z dziś: nocna analiza nadal mówi „zamów”, ale zamówienie już jest — bez drugiej drogi do Kreatora w wierszu.
      // Z terminem harmonogramu zostaje jeszcze jego zamknięcie („Zamówione”); bez terminu wiersz jest zrobiony.
      group = zdToday && !schedule ? "done" : "order";
      action = zdToday ? (schedule ? { kind: "ordered" } : null) : prepare(horizon);
    } else if (offPlan) {
      group = zdToday ? "done" : "early";
      action = zdToday ? null : prepare(true);
    } else if (!schedule) {
      continue; // na żądanie bez pracy, samo odrzucenie — nie ma co robić dziś
    } else if (!schedule.vacationNote && signal && !stale) {
      group = "shift";
      action = { kind: "shift" };
    } else {
      group = "manual";
      action = { kind: "ordered" };
    }

    const sources: DailySupplierSource[] = [];
    if (order || classicPending) sources.push("automat");
    if (schedule) sources.push("harmonogram");
    if (offPlan && !isOnDemand) sources.push("poza-planem");
    if (isOnDemand) sources.push("na-zadanie");

    rows.push({
      supplierId: id,
      supplierName:
        schedule?.supplierName ?? anyOrder?.supplierName ?? pending?.supplierName ?? offPlan?.supplierName ?? onDemandById.get(id)?.supplierName ?? "",
      group,
      sources,
      action,
      schedule,
      overdueDays: schedule ? Math.max(0, daysBetweenKeys(formatDateString(schedule.nextDate), input.todayDateKey)) : 0,
      automatOrder: order,
      pendingProposal: pending,
      automatWarning: pending != null && zdProposalHasWarning(pending),
      vacationNote: schedule?.vacationNote ?? null,
      onVacationNow: input.vacationNowIds.has(id),
      signal,
      signalStale: stale,
      offPlanCount: offPlan?.count ?? 0,
      offPlanNextOrderDate: offPlan?.nextOrderDate ?? null,
      zdToday,
      requestCount,
      stockOutCount,
    });
  }

  const groupRank = (g: DailySupplierGroup) => DAILY_SUPPLIER_GROUP_ORDER.indexOf(g);
  const byName = (a: DailySupplierRow, b: DailySupplierRow) => a.supplierName.localeCompare(b.supplierName, "pl");
  return rows.sort((a, b) => {
    if (a.group !== b.group) return groupRank(a.group) - groupRank(b.group);
    if (a.group === "early") {
      return (
        b.offPlanCount - a.offPlanCount ||
        (a.offPlanNextOrderDate ?? "9999").localeCompare(b.offPlanNextOrderDate ?? "9999") ||
        byName(a, b)
      );
    }
    return (
      Number(b.overdueDays > 0) - Number(a.overdueDays > 0) ||
      (b.signal?.criticalCount ?? 0) - (a.signal?.criticalCount ?? 0) ||
      byName(a, b)
    );
  });
}

export function countDailySupplierGroups(rows: readonly DailySupplierRow[]): Record<DailySupplierGroup, number> {
  const out: Record<DailySupplierGroup, number> = { send: 0, order: 0, early: 0, shift: 0, manual: 0, done: 0 };
  for (const r of rows) out[r.group]++;
  return out;
}

/** Liczniki chipów filtra — wiersz liczy się w każdym swoim źródle; „Zrobione dziś” pominięte. */
export function countDailySupplierSources(rows: readonly DailySupplierRow[]): Record<DailySupplierSource, number> {
  const out: Record<DailySupplierSource, number> = { automat: 0, harmonogram: 0, "poza-planem": 0, "na-zadanie": 0 };
  for (const r of rows) if (r.group !== "done") for (const s of r.sources) out[s]++;
  return out;
}
