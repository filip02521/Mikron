/** Zlecenia serwisowe — czysta logika (statusy, przejścia, numer, grupy, RW). Bez DB. */

export type ServiceOrderStatus =
  | "przyjete"
  | "diagnoza"
  | "w_naprawie"
  | "czeka_na_czesc"
  | "gotowe"
  | "wydane"
  | "anulowane";

export type ServiceOrderEventType =
  | "created"
  | "status"
  | "part_taken"
  | "part_returned"
  | "loaner_linked"
  | "loaner_unlinked"
  | "rw"
  | "note"
  | "invoice"
  | "invoice_cleared"
  | "waiting_part";

/** Kolejność drogi naprawy — oś postępu w panelu zlecenia. „Anulowane” jest poza nią. */
export const SERVICE_ORDER_FLOW: readonly ServiceOrderStatus[] = [
  "przyjete",
  "diagnoza",
  "w_naprawie",
  "gotowe",
  "wydane",
] as const;

export const SERVICE_ORDER_STATUS_LABEL: Record<ServiceOrderStatus, string> = {
  przyjete: "Przyjęte",
  diagnoza: "Diagnoza",
  w_naprawie: "W naprawie",
  czeka_na_czesc: "Czeka na część",
  gotowe: "Gotowe do wydania",
  wydane: "Wydane",
  anulowane: "Anulowane",
};

/**
 * Dozwolone przejścia. Krok wstecz jest dozwolony (pomyłka, powrót z „gotowe” do naprawy),
 * „czeka na część” wraca do naprawy, „wydane” i „anulowane” są końcowe.
 */
const TRANSITIONS: Record<ServiceOrderStatus, readonly ServiceOrderStatus[]> = {
  przyjete: ["diagnoza", "w_naprawie", "anulowane"],
  diagnoza: ["w_naprawie", "czeka_na_czesc", "gotowe", "przyjete", "anulowane"],
  w_naprawie: ["czeka_na_czesc", "gotowe", "diagnoza", "anulowane"],
  czeka_na_czesc: ["w_naprawie", "anulowane"],
  gotowe: ["wydane", "w_naprawie"],
  wydane: [],
  anulowane: [],
};

export function allowedNextStatuses(from: ServiceOrderStatus): readonly ServiceOrderStatus[] {
  return TRANSITIONS[from];
}

export function canMoveServiceOrder(from: ServiceOrderStatus, to: ServiceOrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isClosedServiceOrder(status: ServiceOrderStatus): boolean {
  return status === "wydane" || status === "anulowane";
}

/**
 * Główny ruch naprzód z danego statusu — przycisk główny w panelu. Pozostałe dozwolone przejścia
 * są przyciskami drugorzędnymi.
 */
export function primaryNextStatus(from: ServiceOrderStatus): ServiceOrderStatus | null {
  switch (from) {
    case "przyjete":
      return "diagnoza";
    case "diagnoza":
      return "w_naprawie";
    case "w_naprawie":
      return "gotowe";
    case "czeka_na_czesc":
      return "w_naprawie";
    case "gotowe":
      return "wydane";
    default:
      return null;
  }
}

/**
 * Etykieta przycisku dla przejścia — mówi, co się stanie, nie nazwę statusu. Krok wstecz (z naprawy do
 * diagnozy, z gotowego do naprawy) nazywa się „Wróć do: …”, żeby nie wyglądał na kolejny etap.
 */
export function transitionLabel(to: ServiceOrderStatus, from?: ServiceOrderStatus): string {
  if (from && isBackwardTransition(to, from)) {
    return `Wróć do: ${SERVICE_ORDER_STATUS_LABEL[to].toLowerCase()}`;
  }
  switch (to) {
    case "przyjete":
      return "Cofnij do przyjętych";
    case "diagnoza":
      return "Zacznij diagnozę";
    case "w_naprawie":
      return from === "czeka_na_czesc" ? "Wznów naprawę" : "Zacznij naprawę";
    case "czeka_na_czesc":
      return "Czeka na część";
    case "gotowe":
      return "Oznacz jako gotowe";
    case "wydane":
      return "Wydaj klientowi";
    case "anulowane":
      return "Anuluj zlecenie";
  }
}

/**
 * Zdanie pod przyciskiem głównym: co system zrobi sam po kliknięciu (DESIGN: kontrolka mówi o skutku).
 * null = skutek widać w samej etykiecie.
 */
export function transitionHint(
  to: ServiceOrderStatus,
  ctx: { missing: { rw: boolean; invoice: boolean }; loanerCode: string | null }
): string | null {
  if (to === "gotowe") return "Zlecenie przejdzie do „Gotowe do wydania” — tam wpiszesz fakturę za naprawę i RW na części.";
  if (to === "wydane") {
    const parts = ["Zamyka zlecenie."];
    const missing = missingDocsText(ctx.missing);
    if (missing) parts.push(`${missing} — zlecenie zostanie na liście „Brak dokumentów”.`);
    if (ctx.loanerCode) parts.push(`Odbierz od klienta zamiennik ${ctx.loanerCode}.`);
    return parts.join(" ");
  }
  return null;
}

/**
 * Co panel zlecenia pokazuje na danym kroku — widok idzie za pracą: przy przyjęciu zamiennik,
 * w naprawie części, przy wydaniu dokumenty i telefon do klienta.
 */
export type ServiceOrderPanelView = {
  /** Etykieta pola notatki; null = pole ukryte. */
  workNoteLabel: string | null;
  workNoteEditable: boolean;
  /** Części: ukryte; pobieranie i oddawanie (do RW); tylko oddawanie (anulowane — części wracają na półkę). */
  parts: "hidden" | "edit" | "return-only";
  /** Sekcja dokumentów (faktura + RW). */
  documents: boolean;
  /** Zamiennik na górze panelu (przyjęcie — wtedy się go wydaje). */
  loanerFirst: boolean;
  /** Duży przycisk „Zadzwoń do klienta” (gotowe do wydania). */
  callClient: boolean;
};

export function serviceOrderPanelView(status: ServiceOrderStatus): ServiceOrderPanelView {
  switch (status) {
    case "przyjete":
      return { workNoteLabel: null, workNoteEditable: false, parts: "hidden", documents: false, loanerFirst: true, callClient: false };
    case "diagnoza":
      return { workNoteLabel: "Co ustaliła diagnoza", workNoteEditable: true, parts: "edit", documents: false, loanerFirst: false, callClient: false };
    case "w_naprawie":
    case "czeka_na_czesc":
      return { workNoteLabel: "Opis prac", workNoteEditable: true, parts: "edit", documents: false, loanerFirst: false, callClient: false };
    case "gotowe":
      return { workNoteLabel: "Opis prac", workNoteEditable: true, parts: "edit", documents: true, loanerFirst: false, callClient: true };
    case "wydane":
      // Po wydaniu część można jeszcze dopisać (zapomniana), dopóki nie ma RW.
      return { workNoteLabel: "Opis prac", workNoteEditable: false, parts: "edit", documents: true, loanerFirst: false, callClient: false };
    case "anulowane":
      return { workNoteLabel: "Opis prac", workNoteEditable: false, parts: "return-only", documents: true, loanerFirst: false, callClient: false };
  }
}

/** Krok wstecz po osi naprawy (etykieta „Wróć do”, ikona cofnięcia). Wstrzymanie i anulowanie nim nie są. */
export function isBackwardTransition(to: ServiceOrderStatus, from: ServiceOrderStatus): boolean {
  return to !== "anulowane" && to !== "czeka_na_czesc" && flowIndex(to) >= 0 && flowIndex(to) < flowIndex(from);
}

/** Pozycja na osi postępu: „czeka na część” stoi tam, gdzie naprawa. */
export function flowIndex(status: ServiceOrderStatus): number {
  if (status === "czeka_na_czesc") return SERVICE_ORDER_FLOW.indexOf("w_naprawie");
  return SERVICE_ORDER_FLOW.indexOf(status);
}

/** Numer ZS/RR/MM/NNN: kolejny w miesiącu przyjęcia, liczony z numerów, które już są. */
export function nextServiceOrderNumber(existing: readonly string[], at: Date): string {
  const yy = String(at.getFullYear() % 100).padStart(2, "0");
  const mm = String(at.getMonth() + 1).padStart(2, "0");
  const prefix = `ZS/${yy}/${mm}/`;
  let max = 0;
  for (const n of existing) {
    if (!n.startsWith(prefix)) continue;
    const seq = Number(n.slice(prefix.length));
    if (Number.isInteger(seq) && seq > max) max = seq;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export type ServiceOrderPart = {
  id: string;
  partTwId: number;
  partSymbol: string | null;
  partName: string;
  quantity: number;
  takenAt: string;
  takenByName: string | null;
};

export type ServiceOrder = {
  id: string;
  number: string;
  clientKhId: number | null;
  clientName: string;
  clientPhone: string | null;
  deviceTwId: number | null;
  deviceSymbol: string | null;
  deviceName: string;
  serialNo: string | null;
  fault: string;
  accessories: string;
  workNote: string;
  dueDate: string | null;
  status: ServiceOrderStatus;
  loanerUnitId: string | null;
  rwNumber: string | null;
  rwAt: string | null;
  /** Faktura za naprawę: z listy FS klienta (fsId) albo numer wpisany ręcznie. */
  fsId: number | null;
  fsNumber: string | null;
  /** Naprawa bez faktury (gwarancja, bezpłatna) — powód; wyklucza się z fsNumber. */
  noInvoiceReason: string | null;
  /** Część, na którą zlecenie czeka (status „czeka na część”); requestStatus — status prośby do zakupów, gdy jest. */
  waitingPart: { twId: number | null; symbol: string | null; name: string; qty: number; since: string | null; requestStatus: string | null } | null;
  /** Zakup sprzętu (YYYY-MM-DD) i dokument (FS/PA z listy sprzętu klienta albo wpisany) — podstawa gwarancji. */
  purchaseDate: string | null;
  purchaseDoc: string | null;
  /** Ostatni dzień gwarancji, policzony przy przyjęciu z okresu modelu (service-warranty.ts). */
  warrantyUntil: string | null;
  /** Zgłoszenie w helpdesku sklepu mikran.pl, z którego założono zlecenie (numer service_id). */
  helpdeskId: number | null;
  closedAt: string | null;
  createdAt: string;
};

export type ServiceOrderEvent = {
  id: number;
  orderId: string;
  at: string;
  type: ServiceOrderEventType;
  fromStatus: ServiceOrderStatus | null;
  toStatus: ServiceOrderStatus | null;
  note: string;
  actorName: string | null;
};

/** Numer seryjny do porównań: bez spacji i wielkości liter („H24R 2BEH” = „h24r2beh”). */
export function serialKey(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, "").toLocaleUpperCase("pl-PL");
}

/** Wcześniejsze zlecenie tego samego egzemplarza (po numerze seryjnym). */
export type SerialHistoryItem = {
  id: string;
  number: string;
  status: ServiceOrderStatus;
  deviceName: string;
  createdAt: string;
  closedAt: string | null;
  fault: string;
  workNote: string;
};

/**
 * Część, na którą zlecenie czeka, jest już do wzięcia w potrzebnej ilości (stan z Subiekta minus rezerwacje i części
 * pobrane bez RW). Bez stanu dla tej części (Subiekt niedostępny, część spoza Subiekta) — nie wiemy, więc false.
 */
export function waitingPartArrived(
  order: Pick<ServiceOrder, "status" | "waitingPart">,
  availableByTw: ReadonlyMap<number, number>
): boolean {
  const part = order.waitingPart;
  if (order.status !== "czeka_na_czesc" || part?.twId == null) return false;
  const available = availableByTw.get(part.twId);
  return available != null && available >= part.qty;
}

/**
 * RW wpisuje się po naprawie (od „gotowe”): wcześniej kolejna potrzebna część nie miałaby już gdzie trafić,
 * bo po RW zlecenie nie przyjmuje części.
 */
export function canSetServiceOrderRw(status: ServiceOrderStatus): boolean {
  return status === "gotowe" || isClosedServiceOrder(status);
}

/** Części pobrane, a jeszcze bez RW — to trzeba przepisać do Subiekta. */
export function needsRw(order: Pick<ServiceOrder, "rwNumber">, parts: readonly Pick<ServiceOrderPart, "quantity">[]): boolean {
  return !order.rwNumber && parts.some((p) => p.quantity > 0);
}

/** Pozycje do RW: suma ilości po towarze (ta sama część pobrana dwa razy = jedna pozycja RW). */
export function rwLines(parts: readonly ServiceOrderPart[]): { partTwId: number; partSymbol: string | null; partName: string; quantity: number }[] {
  const byTw = new Map<number, { partTwId: number; partSymbol: string | null; partName: string; quantity: number }>();
  for (const p of parts) {
    const cur = byTw.get(p.partTwId);
    if (cur) cur.quantity += p.quantity;
    else byTw.set(p.partTwId, { partTwId: p.partTwId, partSymbol: p.partSymbol, partName: p.partName, quantity: p.quantity });
  }
  return [...byTw.values()].sort((a, b) => (a.partSymbol ?? a.partName).localeCompare(b.partSymbol ?? b.partName, "pl"));
}

/** Tekst do schowka: symbol TAB ilość w wierszu — wkleja się do pozycji dokumentu albo do notatki. */
export function rwClipboardText(lines: ReturnType<typeof rwLines>): string {
  return lines.map((l) => `${l.partSymbol ?? l.partName}\t${l.quantity}`).join("\n");
}

/** Grupy listy zleceń według tego, co serwisant ma zrobić. */
export type ServiceOrderGroup = "czeka_na_czesc" | "w_serwisie" | "gotowe" | "dokumenty" | "zamkniete";

/**
 * Faktura za naprawę wpisywana od „gotowe” (jak RW). Anulowane zlecenie faktury nie ma — tam tylko RW
 * za części, których nie oddano.
 */
export function canSetServiceOrderInvoice(status: ServiceOrderStatus): boolean {
  return status === "gotowe" || status === "wydane";
}

/** Czego brakuje do rozliczenia zlecenia (tylko ostrzeżenie — wydanie tego nie blokuje). */
export function missingServiceOrderDocs(
  order: Pick<ServiceOrder, "status" | "rwNumber" | "fsNumber" | "noInvoiceReason">,
  parts: readonly Pick<ServiceOrderPart, "quantity">[]
): { rw: boolean; invoice: boolean } {
  return {
    rw: needsRw(order, parts),
    invoice: order.status !== "anulowane" && !order.fsNumber && !order.noInvoiceReason,
  };
}

/** „Brakuje faktury za naprawę i RW” — jedno zdanie o brakach albo null. */
export function missingDocsText(missing: { rw: boolean; invoice: boolean }): string | null {
  const items = [missing.invoice ? "faktury za naprawę" : null, missing.rw ? "RW na części" : null].filter(Boolean);
  return items.length ? `Brakuje ${items.join(" i ")}` : null;
}

export function serviceOrderGroup(
  order: Pick<ServiceOrder, "status" | "rwNumber" | "fsNumber" | "noInvoiceReason">,
  parts: readonly Pick<ServiceOrderPart, "quantity">[]
): ServiceOrderGroup {
  if (isClosedServiceOrder(order.status)) {
    const m = missingServiceOrderDocs(order, parts);
    return m.rw || m.invoice ? "dokumenty" : "zamkniete";
  }
  if (order.status === "czeka_na_czesc") return "czeka_na_czesc";
  if (order.status === "gotowe") return "gotowe";
  return "w_serwisie";
}

/** Termin dla klienta minął, a sprzęt nie jest jeszcze gotowy ani wydany. */
export function isServiceOrderLate(order: Pick<ServiceOrder, "status" | "dueDate">, today: Date): boolean {
  if (!order.dueDate || order.status === "gotowe" || isClosedServiceOrder(order.status)) return false;
  const [y, m, d] = order.dueDate.split("-").map(Number);
  const due = new Date(y!, (m ?? 1) - 1, d ?? 1);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return due < t;
}

export const SERVICE_ORDER_TEXT_MAX = { client: 200, phone: 40, device: 200, serial: 80, fault: 1000, accessories: 300, workNote: 2000, rw: 40 } as const;

/** Numer RW z Subiekta, np. „RW 15/MAG/2026” — litery, cyfry, ukośniki, spacje, myślniki, kropki. */
export function normalizeRwNumber(raw: string): string | null {
  const v = raw.trim().replace(/\s+/g, " ").slice(0, SERVICE_ORDER_TEXT_MAX.rw);
  if (!v) return null;
  if (!/^[\p{L}\p{N} /._-]+$/u.test(v)) return null;
  if (!/\d/.test(v)) return null;
  return v;
}
