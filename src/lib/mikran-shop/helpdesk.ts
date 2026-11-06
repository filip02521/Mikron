import {
  HELPDESK_TEST_TICKETS,
  isClosedHelpdeskStatus,
  parseHelpdeskMessages,
  parseHelpdeskTicket,
  type HelpdeskMessage,
  type HelpdeskTicket,
} from "@/lib/mikran-shop/helpdesk-parse";
import { addDays, toDateOnly } from "@/lib/orders/service-loaners";

/**
 * Helpdesk sklepu mikran.pl przez REST API (OAuth client_credentials). Tylko odczyt — OnTime nie pisze
 * do zgłoszeń (POST wysyłałby klientowi maila: `notify` i `auto_reply` są tam domyślnie włączone).
 *
 * Bez kluczy w env poza produkcją działa na danych testowych (`HELPDESK_TEST_TICKETS`), żeby panel serwisu
 * dało się sprawdzić lokalnie; na produkcji bez kluczy sekcja helpdesku jest wyłączona.
 */

export type HelpdeskMode = "live" | "test" | "off";

const DEFAULT_BASE = "https://mikran.pl";
const TIMEOUT_MS = 8000;

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function intList(raw: string): number[] {
  return raw
    .split(/[,\s]+/)
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0);
}

/**
 * Zapis do helpdesku (status zgłoszenia przy przyjęciu i wydaniu): tylko z MIKRAN_HELPDESK_WRITE=1 i kluczami
 * ze scope helpdesk:write. Zawsze notify=false i bez autoodpowiedzi — OnTime nie wysyła maili do klientów.
 */
export function helpdeskWriteEnabled(): boolean {
  return env("MIKRAN_HELPDESK_WRITE") === "1" && helpdeskMode() === "live";
}

/** status_id w helpdesku (panel sklepu: 1 nowe, 4 przyjęte do realizacji, 5 zakończone); nadpisywane w env. */
export function helpdeskStatusId(kind: "accepted" | "done"): number {
  const raw = Number(env(kind === "accepted" ? "MIKRAN_HELPDESK_STATUS_ACCEPTED" : "MIKRAN_HELPDESK_STATUS_DONE"));
  return Number.isInteger(raw) && raw > 0 ? raw : kind === "accepted" ? 4 : 5;
}

export function helpdeskMode(): HelpdeskMode {
  if (env("MIKRAN_API_CLIENT_ID") && env("MIKRAN_API_CLIENT_SECRET")) return "live";
  return process.env.NODE_ENV === "production" ? "off" : "test";
}

let token: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env("MIKRAN_API_CLIENT_ID"),
    client_secret: env("MIKRAN_API_CLIENT_SECRET"),
    scope: helpdeskWriteEnabled() ? "helpdesk:read helpdesk:write" : "helpdesk:read",
  });
  const res = await fetch(`${env("MIKRAN_API_BASE_URL") || DEFAULT_BASE}/api/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number; error?: string } | null;
  if (!res.ok || !json?.access_token) {
    throw new Error(`Helpdesk mikran.pl odrzucił klucze API (${res.status}${json?.error ? ` ${json.error}` : ""}). Sprawdź MIKRAN_API_CLIENT_ID i sekret.`);
  }
  token = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return token.value;
}

async function apiGet(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(`${env("MIKRAN_API_BASE_URL") || DEFAULT_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const call = async () =>
    fetch(url, {
      headers: { Authorization: `Bearer ${await accessToken()}`, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  let res = await call();
  if (res.status === 401) {
    // Token mógł wygasnąć po stronie sklepu wcześniej niż mówi expires_in — jedna ponowna próba z nowym.
    token = null;
    res = await call();
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Helpdesk mikran.pl nie odpowiedział poprawnie (${res.status}). Spróbuj za chwilę.`);
  return res.json();
}

function testTickets(): HelpdeskTicket[] {
  // Daty liczone od dziś — „dziś / wczoraj” w panelu nie starzeją się razem z danymi.
  return HELPDESK_TEST_TICKETS.map((t, i) => ({
    ...t,
    dateAdded: toDateOnly(addDays(new Date(), -i)),
  }));
}

/**
 * Otwarte zgłoszenia serwisanta (MIKRAN_HELPDESK_EMPLOYEE_ID), bez „Zakończonych”. Statusy do pobrania
 * można zawęzić w MIKRAN_HELPDESK_STATUS_IDS (np. „1,2” = nowe i przyjęte do realizacji); bez tego
 * bierzemy ostatnie 90 dni i odrzucamy zakończone po nazwie statusu.
 */
export async function fetchOpenServiceTickets(): Promise<{ mode: HelpdeskMode; tickets: HelpdeskTicket[] }> {
  const mode = helpdeskMode();
  if (mode === "off") return { mode, tickets: [] };
  if (mode === "test") return { mode, tickets: testTickets() };

  const employee = env("MIKRAN_HELPDESK_EMPLOYEE_ID");
  const statuses = intList(env("MIKRAN_HELPDESK_STATUS_IDS"));
  const now = new Date();
  const from = toDateOnly(addDays(now, -90));
  const queries = statuses.length ? statuses.map((s) => ({ status_id: String(s) })) : [{ date_from: from, date_to: toDateOnly(now) }];
  const pages = await Promise.all(
    queries.map((q) =>
      apiGet("/api/v1/helpdesk", { ...q, employee_id: employee, pageSize: "100", sort: "s.date_added", order: "DESC" })
    )
  );
  const seen = new Set<number>();
  const tickets: HelpdeskTicket[] = [];
  for (const page of pages) {
    const rows = page && typeof page === "object" && Array.isArray((page as { data?: unknown }).data) ? (page as { data: unknown[] }).data : [];
    for (const row of rows) {
      const t = parseHelpdeskTicket(row);
      if (!t || seen.has(t.id) || isClosedHelpdeskStatus(t.status)) continue;
      seen.add(t.id);
      tickets.push(t);
    }
  }
  tickets.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded) || b.id - a.id);
  return { mode, tickets };
}

/**
 * Szukanie w całym helpdesku (q jak w panelu: numer, klient, e-mail, telefon, firma, NIP, produkt, faktura, opis),
 * wszystkie statusy i osoby — do wyboru zgłoszenia przy przyjęciu, gdy nie ma go na liście serwisanta.
 */
export async function searchHelpdeskTickets(q: string): Promise<{ mode: HelpdeskMode; tickets: HelpdeskTicket[] }> {
  const mode = helpdeskMode();
  const term = q.trim();
  if (mode === "off" || term.length < 2) return { mode, tickets: [] };
  if (mode === "test") {
    const words = term.toLocaleLowerCase("pl-PL").split(/\s+/);
    const hay = (t: HelpdeskTicket) => `${t.id} ${t.name} ${t.company} ${t.product} ${t.email} ${t.telephone} ${t.vat}`.toLocaleLowerCase("pl-PL");
    return { mode, tickets: testTickets().filter((t) => words.every((w) => hay(t).includes(w))) };
  }
  const page = await apiGet("/api/v1/helpdesk", { q: term, pageSize: "20", sort: "s.date_added", order: "DESC" });
  const rows = page && typeof page === "object" && Array.isArray((page as { data?: unknown }).data) ? (page as { data: unknown[] }).data : [];
  return { mode, tickets: rows.map((r) => parseHelpdeskTicket(r)).filter((t): t is HelpdeskTicket => t != null) };
}

/** Wątek zgłoszenia (rozmowa z klientem) od najstarszej wiadomości. */
export async function fetchHelpdeskMessages(id: number): Promise<{ mode: HelpdeskMode; messages: HelpdeskMessage[] }> {
  const mode = helpdeskMode();
  if (mode === "off") return { mode, messages: [] };
  if (mode === "test") {
    const t = testTickets().find((x) => x.id === id);
    if (!t) return { mode, messages: [] };
    return {
      mode,
      messages: [
        { id: 1, at: `${t.dateAdded} 09:00:00`, author: t.name, staff: false, hidden: false, text: t.comment, status: "Nowe zgłoszenie" },
        { id: 2, at: `${t.dateAdded} 10:30:00`, author: "Serwis TEST", staff: true, hidden: false, text: "TEST — prosimy o przesłanie sprzętu kurierem GLS (instrukcja pakowania w załączniku).", status: "Przyjęte do realizacji" },
      ],
    };
  }
  return { mode, messages: parseHelpdeskMessages(await apiGet(`/api/v1/helpdesk/${id}/messages`)) };
}

/**
 * Status zgłoszenia w helpdesku (np. przyjęcie sprzętu → przyjęte do realizacji). Krótki wpis ukryty od klienta,
 * notify=false — bez maila. Bez MIKRAN_HELPDESK_WRITE=1 nic nie robi i zwraca false.
 */
export async function setHelpdeskStatus(id: number, statusId: number, comment: string): Promise<boolean> {
  if (!helpdeskWriteEnabled()) return false;
  const res = await fetch(`${env("MIKRAN_API_BASE_URL") || DEFAULT_BASE}/api/v1/helpdesk/${id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ comment: comment.slice(0, 500), service_status_id: statusId, notify: false }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Helpdesk mikran.pl nie zapisał statusu zgłoszenia #${id} (${res.status}).`);
  return true;
}

/** Jedno zgłoszenie z wątkiem (opis klienta = pierwsza wiadomość). null — nie ma takiego numeru. */
export async function fetchHelpdeskTicket(id: number): Promise<{ mode: HelpdeskMode; ticket: HelpdeskTicket | null }> {
  const mode = helpdeskMode();
  if (mode === "off") return { mode, ticket: null };
  if (mode === "test") return { mode, ticket: testTickets().find((t) => t.id === id) ?? null };
  return { mode, ticket: parseHelpdeskTicket(await apiGet(`/api/v1/helpdesk/${id}`)) };
}
