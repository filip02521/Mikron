/**
 * Zgłoszenia helpdesku sklepu mikran.pl (`/api/v1/helpdesk`) — czysta logika, bez sieci.
 *
 * API opisuje wiersz jako „dowolny obiekt” (tabela `oc_service` OpenCarta), więc parser czyta kilka
 * możliwych nazw pól i dekoduje encje HTML, które sklep zostawia w tekstach (`htmlentities`).
 */

export type HelpdeskTicket = {
  id: number;
  name: string;
  email: string;
  telephone: string;
  company: string;
  /** NIP tak, jak wpisał klient (może mieć kreski, spacje, prefiks PL). */
  vat: string;
  product: string;
  invoiceId: string;
  quantity: number | null;
  /** Opis klienta: pole zgłoszenia albo pierwsza wiadomość wątku. */
  comment: string;
  /** YYYY-MM-DD lub pełna data z API. */
  dateAdded: string;
  statusId: number | null;
  status: string;
  typeId: number | null;
  type: string;
  employeeId: number | null;
  employee: string;
  /** 0 = nie ustalono, 1 = klient wysyła, 2 = odbiera Mikran. */
  deliveryId: number | null;
  /** Zgłoszenie z danych testowych (bez kluczy API), nie z mikran.pl. */
  test: boolean;
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  oacute: "ó",
  Oacute: "Ó",
  ndash: "–",
  mdash: "—",
  bdquo: "„",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
};

/** shortcut: tylko encje liczbowe i te z mapy wyżej — wystarcza dla polskich tekstów z `htmlentities`; inne zostają dosłownie. */
export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
    }
    return NAMED_ENTITIES[code] ?? whole;
  });
}

function pick(raw: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = raw[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function str(raw: Record<string, unknown>, keys: string[]): string {
  const v = pick(raw, keys);
  if (typeof v === "string") return decodeHtmlEntities(v).replace(/<br\s*\/?>/gi, "\n").trim();
  if (typeof v === "number") return String(v);
  return "";
}

function int(raw: Record<string, unknown>, keys: string[]): number | null {
  const v = pick(raw, keys);
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN;
  return Number.isInteger(n) ? n : null;
}

function firstMessage(raw: Record<string, unknown>): string {
  const list = raw.messages ?? raw.history;
  if (!Array.isArray(list)) return "";
  // Wątek bywa od najnowszej — opis zgłoszenia to najstarsza wiadomość.
  const rows = list.filter((m): m is Record<string, unknown> => !!m && typeof m === "object");
  const dated = rows.map((m) => ({ m, at: str(m, ["date_added", "date", "created_at"]) }));
  dated.sort((a, b) => (a.at && b.at ? a.at.localeCompare(b.at) : 0));
  for (const { m } of dated) {
    const text = str(m, ["comment", "message", "text", "body"]);
    if (text) return text;
  }
  return "";
}

export function parseHelpdeskTicket(raw: unknown, test = false): HelpdeskTicket | null {
  if (!raw || typeof raw !== "object") return null;
  const r = (raw as Record<string, unknown>).data && typeof (raw as Record<string, unknown>).data === "object" && !Array.isArray((raw as Record<string, unknown>).data)
    ? ((raw as Record<string, unknown>).data as Record<string, unknown>)
    : (raw as Record<string, unknown>);
  const id = int(r, ["service_id", "helpdesk_id", "id"]);
  if (!id || id <= 0) return null;
  return {
    id,
    name: str(r, ["name", "customer", "firstname"]),
    email: str(r, ["email"]),
    telephone: str(r, ["telephone", "phone"]),
    company: str(r, ["company"]),
    vat: str(r, ["vat", "nip"]),
    product: str(r, ["product"]),
    invoiceId: str(r, ["invoice_id", "invoice"]),
    quantity: int(r, ["quantity"]),
    comment: str(r, ["comment", "description"]) || firstMessage(r),
    dateAdded: str(r, ["date_added", "created_at", "date"]),
    statusId: int(r, ["service_status_id", "status_id"]),
    status: str(r, ["status", "status_name", "service_status"]),
    typeId: int(r, ["service_type_id", "type_id"]),
    type: str(r, ["type", "type_name", "service_type"]),
    employeeId: int(r, ["employee_id", "user_id"]),
    employee: str(r, ["employee", "employee_name", "user"]),
    deliveryId: int(r, ["delivery_id"]),
    test,
  };
}

/** Zgłoszenie zamknięte w helpdesku („Zakończone”) — nie czeka już na sprzęt. */
export function isClosedHelpdeskStatus(status: string): boolean {
  return /zako[nń]czon|zamkni[eę]t/i.test(status);
}

/** Sam ciąg cyfr NIP (bez „PL”, kresek i spacji); pusty, gdy to nie wygląda na NIP. */
export function nipDigits(vat: string): string {
  const d = vat.replace(/^\s*PL/i, "").replace(/\D/g, "");
  return d.length === 10 ? d : "";
}

/** Numer zgłoszenia wpisany przez serwisanta: „1234”, „#1234”, „HD 1234”. */
export function parseHelpdeskNumber(input: string): number | null {
  const m = input.trim().match(/^(?:#|hd\s*)?(\d{1,9})$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 ? n : null;
}

/** Dane testowe — gdy brak kluczy API (dev). Każde pole mówi wprost, że to test. */
export const HELPDESK_TEST_TICKETS: HelpdeskTicket[] = [
  {
    id: 900001,
    name: "TEST Jan Testowy",
    email: "serwis.test@example.com",
    telephone: "500 000 001",
    company: "TEST Gabinet Stomatologiczny",
    vat: "",
    product: "Mikrosilnik TEST (dane testowe)",
    invoiceId: "",
    quantity: 1,
    comment: "TEST — zgłoszenie testowe, nie od klienta. Silnik nie rusza po włączeniu pedału.",
    dateAdded: "",
    statusId: 1,
    status: "Nowe zgłoszenie",
    typeId: null,
    type: "service",
    employeeId: 0,
    employee: "Serwis TEST",
    deliveryId: 1,
    test: true,
  },
  {
    id: 900002,
    name: "TEST Anna Próbna",
    email: "serwis.test@example.com",
    telephone: "500 000 002",
    company: "",
    vat: "",
    product: "Lampa polimeryzacyjna TEST (dane testowe)",
    invoiceId: "",
    quantity: 1,
    comment: "TEST — zgłoszenie testowe, nie od klienta. Lampa gaśnie po 5 sekundach.",
    dateAdded: "",
    statusId: 2,
    status: "Przyjęte do realizacji",
    typeId: null,
    type: "claim",
    employeeId: 0,
    employee: "Serwis TEST",
    deliveryId: 2,
    test: true,
  },
];

/**
 * Pole „Produkt” zgłoszenia bywa z numerem seryjnym („Forte 400 SN AB123”, „Turbina S/N: 4321”).
 * Numer idzie do pola SN, nazwa — do sprzętu. Bez znacznika SN całość zostaje nazwą.
 */
export function splitProductSerial(product: string): { name: string; serial: string } {
  const m = product.match(/^(.*?)[\s,;&]*\bS\s*\/?\s*N\b\s*[:.#]?\s*([A-Za-z0-9][A-Za-z0-9/._-]{2,39})\s*$/i);
  if (!m) return { name: product.trim(), serial: "" };
  return { name: (m[1] ?? "").replace(/[\s,;&-]+$/, "").trim() || product.trim(), serial: m[2]! };
}

/** Adres pracownika Mikranu: zgłoszenie założył serwis za klienta, więc e-mail nie wskazuje klienta. */
export function isStaffEmail(email: string): boolean {
  return /@mikran\.(pl|com)$/i.test(email.trim());
}

/**
 * Numer faktury ze zgłoszenia: pole „Nr faktury”, a gdy puste — z produktu albo opisu
 * („faktura nr 1617/M/09/2025. Marathon multi 600”, „FV 434/M/11/2026”). Zwraca sam numer („1617/M/09/2025”).
 */
export function extractInvoiceNumber(...fields: string[]): string {
  for (const f of fields) {
    const m = f.match(/(?:\b(?:FS|FV|faktur[ay]?)\b\s*(?:nr\.?|numer)?\s*:?\s*)?(\d{1,7}\/[A-Z]{1,3}\/\d{2}\/\d{4})\b/i);
    if (m) return m[1]!.toUpperCase();
  }
  return "";
}

export type HelpdeskMessage = {
  id: number | null;
  at: string;
  author: string;
  /** Wpis od pracownika (odpowiedź serwisu), nie od klienta. */
  staff: boolean;
  /** Komentarz ukryty — klient go nie widzi. */
  hidden: boolean;
  text: string;
  status: string;
};

/** Wątek zgłoszenia z `/helpdesk/{id}/messages` (pola wiadomości jak w historii panelu sklepu), od najstarszej. */
export function parseHelpdeskMessages(raw: unknown): HelpdeskMessage[] {
  const list = raw && typeof raw === "object" ? (raw as { messages?: unknown; data?: unknown }).messages ?? (raw as { data?: unknown }).data : null;
  if (!Array.isArray(list)) return [];
  const out: HelpdeskMessage[] = [];
  for (const m of list) {
    if (!m || typeof m !== "object") continue;
    const r = m as Record<string, unknown>;
    const text = str(r, ["comment", "message", "text", "body"]);
    if (!text) continue;
    const userId = int(r, ["user_id"]);
    out.push({
      id: int(r, ["service_history_id", "history_id", "id"]),
      at: str(r, ["date_added", "date", "created_at"]),
      author: str(r, ["author", "user", "name", "firstname"]),
      staff: userId != null && userId > 0,
      hidden: /^(1|true)$/i.test(str(r, ["hidden", "is_hidden", "private"])) || r.notify === 0 || r.notify === "0",
      text,
      status: str(r, ["status", "service_status"]),
    });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}
