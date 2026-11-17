import { isClosedHelpdeskStatus, splitProductSerial, type HelpdeskTicket } from "@/lib/mikran-shop/helpdesk-parse";
import { serialKey } from "@/lib/orders/service-orders";

/** Nazwa do porównania: małe litery, tylko litery i cyfry rozdzielone pojedynczą spacją. */
function nameKey(raw: string): string {
  return raw.toLocaleLowerCase("pl-PL").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/**
 * Inne zgłoszenie w helpdesku to możliwy duplikat sprawy tego zlecenia, gdy jest otwarte i dotyczy tego samego sprzętu:
 * numer seryjny zlecenia stoi w produkcie lub opisie zgłoszenia albo nazwa produktu pokrywa się z nazwą sprzętu
 * (jedna zawiera drugą). Krótkie numery i nazwy (< 4 znaki) nie liczą się — „SN 12” pasuje do wszystkiego.
 */
export function isPossibleDuplicateTicket(
  ticket: Pick<HelpdeskTicket, "status" | "product" | "comment">,
  order: { deviceName: string; serialNo: string | null }
): boolean {
  if (isClosedHelpdeskStatus(ticket.status)) return false;
  const sn = serialKey(order.serialNo);
  if (sn.length >= 4 && serialKey(`${ticket.product} ${ticket.comment}`).includes(sn)) return true;
  const a = nameKey(splitProductSerial(ticket.product).name);
  const b = nameKey(order.deviceName);
  if (a.length < 4 || b.length < 4) return false;
  return a.includes(b) || b.includes(a);
}

/** Data z helpdesku („2026-11-05 14:32:00”, „2026-11-05”) jako „05.11.2026 14:32”; inny zapis zostaje, jak przyszedł. */
export function formatHelpdeskWhen(at: string): string {
  const m = at.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return at;
  const day = `${m[3]}.${m[2]}.${m[1]}`;
  return m[4] && `${m[4]}:${m[5]}` !== "00:00" ? `${day} ${m[4]}:${m[5]}` : day;
}
