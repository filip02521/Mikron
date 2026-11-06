/**
 * Tablica serwisu: kolejka według tego, co serwisant ma zrobić, i rubryki karty z pieczątkami
 * (DESIGN-serwis.md). Czysta logika, bez DB.
 */
import {
  isClosedServiceOrder,
  isServiceOrderLate,
  SERVICE_QUOTE_NUDGE_DAYS,
  serviceOrderGroup,
  type ServiceOrder,
  type ServiceOrderEvent,
  type ServiceOrderPart,
  type ServiceOrderStatus,
} from "@/lib/orders/service-orders";

/** Grupy tablicy, rozłączne: każde zlecenie jest w jednej. Kolejność = kolejność na ekranie. */
export type ServiceBoardLane = "teraz" | "do_wydania" | "klient" | "w_naprawie" | "czeka" | "dokumenty" | "zamkniete";

export const SERVICE_BOARD_LANES: readonly ServiceBoardLane[] = ["teraz", "do_wydania", "klient", "w_naprawie", "czeka", "dokumenty", "zamkniete"];

export const SERVICE_BOARD_LANE_LABEL: Record<ServiceBoardLane, string> = {
  teraz: "Do ruchu teraz",
  do_wydania: "Do wydania",
  klient: "Czeka na klienta",
  w_naprawie: "W naprawie",
  czeka: "Czeka na część",
  dokumenty: "Bez dokumentów",
  zamkniete: "Zamknięte",
};

/** Dlaczego zlecenie jest w „teraz”: część na stanie (wznów), termin dla klienta minął albo klient milczy po wycenie. */
export type ServiceNowReason = "czesc" | "termin" | "klient";

/** Ile pełnych dni minęło od wysłania wyceny (po dniach kalendarza, czas lokalny). */
export function quoteWaitingDays(sentAt: string | null, today: Date): number | null {
  if (!sentAt) return null;
  const a = new Date(sentAt);
  const from = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

export function serviceOrderNowReason(
  order: Pick<ServiceOrder, "status" | "dueDate"> & { quote?: Pick<ServiceOrder["quote"], "sentAt"> },
  ctx: { arrived: boolean; today: Date }
): ServiceNowReason | null {
  if (isClosedServiceOrder(order.status) || order.status === "gotowe") return null;
  if (ctx.arrived) return "czesc";
  if (isServiceOrderLate(order, ctx.today)) return "termin";
  if (order.status === "czeka_na_akceptacje" && (quoteWaitingDays(order.quote?.sentAt ?? null, ctx.today) ?? 0) >= SERVICE_QUOTE_NUDGE_DAYS) return "klient";
  return null;
}

export function serviceOrderLane(
  order: Pick<ServiceOrder, "status" | "dueDate" | "rwNumber" | "fsNumber" | "noInvoiceReason"> & { quote?: Pick<ServiceOrder["quote"], "sentAt"> },
  parts: readonly Pick<ServiceOrderPart, "quantity">[],
  ctx: { arrived: boolean; today: Date }
): ServiceBoardLane {
  if (isClosedServiceOrder(order.status)) return serviceOrderGroup(order, parts) === "dokumenty" ? "dokumenty" : "zamkniete";
  if (order.status === "gotowe") return "do_wydania";
  if (serviceOrderNowReason(order, ctx)) return "teraz";
  if (order.status === "czeka_na_akceptacje") return "klient";
  return order.status === "czeka_na_czesc" ? "czeka" : "w_naprawie";
}

/** Rubryki karty: pięć kroków drogi naprawy. „Czeka na część” to stan rubryki Naprawa, nie osobna rubryka. */
export type ServiceStampKey = "przyjete" | "diagnoza" | "w_naprawie" | "gotowe" | "wydane";

export const SERVICE_STAMP_LABEL: Record<ServiceStampKey, string> = {
  przyjete: "Przyjęto",
  diagnoza: "Diagnoza",
  w_naprawie: "Naprawa",
  gotowe: "Gotowe",
  wydane: "Wydano",
};

const STAMP_KEYS: readonly ServiceStampKey[] = ["przyjete", "diagnoza", "w_naprawie", "gotowe", "wydane"];

/**
 * done — krok za nami, z pieczątką; current — tu jest zlecenie teraz (pieczątka + obrys); waiting — naprawa
 * stoi na części; skipped — krok pominięty (np. od razu do naprawy); empty — jeszcze przed nami.
 */
export type ServiceStampState = "done" | "current" | "waiting" | "skipped" | "empty";

export type ServiceStamp = {
  key: ServiceStampKey;
  label: string;
  /** Na co czeka rubryka w stanie „waiting”: część (Naprawa) albo decyzja klienta po wycenie (Diagnoza). */
  waitingFor?: "czesc" | "klient";
  /** Kiedy zlecenie weszło w ten krok (ostatni raz) — ISO. */
  at: string | null;
  actor: string | null;
  state: ServiceStampState;
};

function stepIndex(status: ServiceOrderStatus): number {
  if (status === "czeka_na_czesc") return STAMP_KEYS.indexOf("w_naprawie");
  if (status === "czeka_na_akceptacje") return STAMP_KEYS.indexOf("diagnoza");
  if (status === "anulowane") return -1;
  return STAMP_KEYS.indexOf(status as ServiceStampKey);
}

export function serviceOrderStamps(
  order: Pick<ServiceOrder, "status" | "createdAt">,
  events: readonly Pick<ServiceOrderEvent, "type" | "toStatus" | "at" | "actorName">[]
): ServiceStamp[] {
  // Ostatnie wejście w każdy krok (po cofnięciu i ponownym wejściu liczy się nowa data).
  const entered = new Map<ServiceStampKey, { at: string; actor: string | null }>();
  for (const e of [...events].sort((a, b) => a.at.localeCompare(b.at))) {
    const key: ServiceStampKey | null =
      e.type === "created" ? "przyjete" : e.type === "status" && e.toStatus && (STAMP_KEYS as readonly string[]).includes(e.toStatus) ? (e.toStatus as ServiceStampKey) : null;
    if (key) entered.set(key, { at: e.at, actor: e.actorName });
  }
  if (!entered.has("przyjete")) entered.set("przyjete", { at: order.createdAt, actor: null });

  // Anulowane: kroki do ostatniego osiągniętego zostają, dalej puste.
  let current = stepIndex(order.status);
  if (current < 0) current = Math.max(...STAMP_KEYS.map((k, i) => (entered.has(k) ? i : 0)));

  return STAMP_KEYS.map((key, i) => {
    const hit = entered.get(key) ?? null;
    let state: ServiceStampState;
    if (i > current) state = "empty";
    else if (i < current) state = hit ? "done" : "skipped";
    else if (order.status === "czeka_na_czesc" || order.status === "czeka_na_akceptacje") state = "waiting";
    else if (order.status === "wydane" || order.status === "anulowane") state = "done";
    else state = "current";
    const waitingFor = state === "waiting" ? (order.status === "czeka_na_akceptacje" ? "klient" : "czesc") : undefined;
    return { key, label: SERVICE_STAMP_LABEL[key], at: i <= current ? hit?.at ?? null : null, actor: i <= current ? hit?.actor ?? null : null, state, ...(waitingFor ? { waitingFor } : {}) };
  });
}
