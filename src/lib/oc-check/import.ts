import { OC_LINE_KINDS, OC_STATUSES, type OcCheckStatus, type OcLineKind } from "./types";

/**
 * Format wymiany z rutyną kontroli OC (dziś: wklejany JSON, później: zapis z crona Gmail).
 * Walidacja ręczna — treść pochodzi z maili dostawców, więc przycinamy długości i odrzucamy obce wartości.
 */

export type OcImportLine = {
  position: number;
  symbol: string;
  name: string;
  qty_ordered: number | null;
  qty_confirmed: number | null;
  unit_ordered: string;
  unit_confirmed: string;
  price_ordered: number | null;
  price_confirmed: number | null;
  currency: string;
  delivery_date: string | null;
  kind: OcLineKind;
  note: string;
};

export type OcImportCheck = {
  source_key: string;
  mailbox: string;
  gmail_thread_id: string | null;
  gmail_message_id: string | null;
  supplier_name: string;
  zd_number: string;
  oc_number: string;
  oc_received_at: string | null;
  status: OcCheckStatus;
  priority: 0 | 1 | 2;
  summary: string;
  next_step: string;
  lines_total: number | null;
  lines_ok: number | null;
  lines: OcImportLine[];
};

export type OcImportResult =
  | { ok: true; checks: OcImportCheck[] }
  | { ok: false; error: string };

const MAX_CHECKS = 200;
const MAX_LINES = 500;
const GMAIL_ID_RE = /^[0-9a-f]{10,24}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function count(value: unknown): number | null {
  const n = num(value);
  return n !== null && Number.isInteger(n) && n >= 0 ? n : null;
}

function gmailId(value: unknown): string | null {
  const v = text(value, 32);
  return GMAIL_ID_RE.test(v) ? v.toLowerCase() : null;
}

function isoDateTime(value: unknown): string | null {
  const v = text(value, 40);
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function isoDate(value: unknown): string | null {
  const v = text(value, 10);
  return DATE_RE.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()) ? v : null;
}

function parseLine(raw: unknown, index: number): OcImportLine | string {
  if (!raw || typeof raw !== "object") return `pozycja ${index + 1}: oczekiwano obiektu`;
  const r = raw as Record<string, unknown>;
  const kind = text(r.kind, 20) as OcLineKind;
  if (!OC_LINE_KINDS.includes(kind)) return `pozycja ${index + 1}: nieznany rodzaj „${text(r.kind, 20)}”`;
  return {
    position: count(r.position) ?? index + 1,
    symbol: text(r.symbol, 120),
    name: text(r.name, 300),
    qty_ordered: num(r.qty_ordered),
    qty_confirmed: num(r.qty_confirmed),
    unit_ordered: text(r.unit_ordered, 30),
    unit_confirmed: text(r.unit_confirmed, 30),
    price_ordered: num(r.price_ordered),
    price_confirmed: num(r.price_confirmed),
    currency: text(r.currency, 3).toUpperCase(),
    delivery_date: isoDate(r.delivery_date),
    kind,
    note: text(r.note, 500),
  };
}

function parseCheck(raw: unknown, index: number): OcImportCheck | string {
  const at = `sprawa ${index + 1}`;
  if (!raw || typeof raw !== "object") return `${at}: oczekiwano obiektu`;
  const r = raw as Record<string, unknown>;

  const status = text(r.status, 20) as OcCheckStatus;
  if (!OC_STATUSES.includes(status)) return `${at}: nieznany status „${text(r.status, 20)}”`;

  const threadId = gmailId(r.gmail_thread_id);
  const messageId = gmailId(r.gmail_message_id);
  // Bez jawnego klucza sprawę identyfikuje wiadomość z OC — ponowny import jej nie dubluje.
  const sourceKey =
    text(r.source_key, 200) || (messageId ? `gmail:${messageId}` : threadId ? `gmail-thread:${threadId}` : "");
  if (!sourceKey) return `${at}: brak source_key i identyfikatora wiadomości`;

  const supplier = text(r.supplier_name, 200);
  if (!supplier) return `${at}: brak supplier_name`;

  const rawLines = Array.isArray(r.lines) ? r.lines : [];
  if (rawLines.length > MAX_LINES) return `${at}: za dużo pozycji (${rawLines.length})`;
  const lines: OcImportLine[] = [];
  for (const [i, rawLine] of rawLines.entries()) {
    const line = parseLine(rawLine, i);
    if (typeof line === "string") return `${at}, ${line}`;
    lines.push(line);
  }
  const positions = new Set(lines.map((l) => l.position));
  if (positions.size !== lines.length) return `${at}: powtórzone numery pozycji`;

  const linesTotal = count(r.lines_total);
  const linesOk = count(r.lines_ok);
  if (linesTotal !== null && linesOk !== null && linesOk > linesTotal) {
    return `${at}: lines_ok większe niż lines_total`;
  }
  const priority = count(r.priority);

  return {
    source_key: sourceKey,
    mailbox: text(r.mailbox, 200).toLowerCase(),
    gmail_thread_id: threadId,
    gmail_message_id: messageId,
    supplier_name: supplier,
    zd_number: text(r.zd_number, 60),
    oc_number: text(r.oc_number, 120),
    oc_received_at: isoDateTime(r.oc_received_at),
    status,
    priority: priority === 1 || priority === 2 ? priority : 0,
    summary: text(r.summary, 2000),
    next_step: text(r.next_step, 1000),
    lines_total: linesTotal !== null && linesOk !== null ? linesTotal : null,
    lines_ok: linesTotal !== null && linesOk !== null ? linesOk : null,
    lines,
  };
}

export function parseOcImport(input: string): OcImportResult {
  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch {
    return { ok: false, error: "To nie jest poprawny JSON." };
  }
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { checks?: unknown }).checks)
      ? (data as { checks: unknown[] }).checks
      : null;
  if (!list) return { ok: false, error: "Oczekiwano tablicy spraw albo obiektu { checks: [...] }." };
  if (list.length === 0) return { ok: false, error: "Brak spraw do importu." };
  if (list.length > MAX_CHECKS) return { ok: false, error: `Za dużo spraw naraz (${list.length}, maks. ${MAX_CHECKS}).` };

  const checks: OcImportCheck[] = [];
  const keys = new Set<string>();
  for (const [i, raw] of list.entries()) {
    const check = parseCheck(raw, i);
    if (typeof check === "string") return { ok: false, error: check };
    if (keys.has(check.source_key)) return { ok: false, error: `Powtórzony source_key: ${check.source_key}` };
    keys.add(check.source_key);
    checks.push(check);
  }
  return { ok: true, checks };
}
