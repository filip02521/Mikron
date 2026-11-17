/** Zgłoszenia helpdesku przy przyjęciu sprzętu — czysta logika listy i wyboru (tablica i okno przyjęcia). */
import type { HelpdeskTicket } from "@/lib/mikran-shop/helpdesk-parse";
import type { HelpdeskLinkedOrder } from "@/lib/data/service-orders";
import type { ServiceInboundMethod } from "@/lib/orders/service-orders";

/** Tekst do szukania: numer, klient, gabinet, sprzęt (z SN), e-mail, telefon (także same cyfry), SN przyjętych zleceń. */
export function helpdeskSearchText(t: HelpdeskTicket, orders: readonly HelpdeskLinkedOrder[] = []): string {
  const serials = orders.map((o) => `${o.number} ${o.serialNo ?? ""}`).join(" ");
  return `${t.id} #${t.id} ${t.name} ${t.company} ${t.product} ${t.email} ${t.telephone} ${t.telephone.replace(/\D/g, "")} ${serials}`.toLocaleLowerCase("pl-PL");
}

export function searchWords(query: string): string[] {
  return query.trim().toLocaleLowerCase("pl-PL").split(/\s+/).filter(Boolean);
}

/** Zgłoszenia pasujące do wszystkich słów; bez przyjętego sprzętu najpierw, poza tym kolejność z helpdesku. */
export function matchHelpdeskTickets<T extends HelpdeskTicket>(
  tickets: readonly T[],
  query: string,
  linked: Readonly<Record<number, readonly HelpdeskLinkedOrder[]>>
): T[] {
  const words = searchWords(query);
  const hits = tickets.filter((t) => {
    const hay = helpdeskSearchText(t, linked[t.id]);
    return words.every((w) => hay.includes(w));
  });
  return sortTicketsForIntake(hits, linked);
}

export function sortTicketsForIntake<T extends HelpdeskTicket>(tickets: readonly T[], linked: Readonly<Record<number, readonly HelpdeskLinkedOrder[]>>): T[] {
  // sort jest stabilny — w obrębie grupy zostaje kolejność z helpdesku.
  return [...tickets].sort((a, b) => Number(!!linked[a.id]?.length) - Number(!!linked[b.id]?.length));
}

/** Zgłoszenia, z których nie przyjęto jeszcze żadnego sprzętu (licznik zdania stanu i nagłówka sekcji). */
export function countTicketsWithoutOrders(tickets: readonly HelpdeskTicket[], linked: Readonly<Record<number, readonly HelpdeskLinkedOrder[]>>): number {
  return tickets.filter((t) => !linked[t.id]?.length).length;
}

/** Sposób dostawy ze zgłoszenia: 1 = klient wysyła, 2 = odbiera Mikran; 0 i brak — nie ustalono. */
export function inboundFromDelivery(deliveryId: number | null | undefined): ServiceInboundMethod | null {
  return deliveryId === 1 ? "kurier_klienta" : deliveryId === 2 ? "odbior_mikran" : null;
}

/** „ZS/26/11/005 · Turbina · SN 4321” — zlecenie przyjęte ze zgłoszenia, w jednej linii. */
export function linkedOrderLine(o: HelpdeskLinkedOrder): string {
  return [o.number, o.deviceName, o.serialNo ? `SN ${o.serialNo}` : null].filter(Boolean).join(" · ");
}
