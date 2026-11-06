import { describe, expect, it } from "vitest";
import { HELPDESK_TEST_TICKETS, type HelpdeskTicket } from "@/lib/mikran-shop/helpdesk-parse";
import type { HelpdeskLinkedOrder } from "@/lib/data/service-orders";
import {
  countTicketsWithoutOrders,
  inboundFromDelivery,
  linkedOrderLine,
  matchHelpdeskTickets,
  sortTicketsForIntake,
} from "./helpdesk-intake";

const [a, b] = HELPDESK_TEST_TICKETS as [HelpdeskTicket, HelpdeskTicket];
const order: HelpdeskLinkedOrder = { id: "o1", number: "ZS/26/11/005", deviceName: "Turbina", serialNo: "AB123", status: "przyjete" };

describe("matchHelpdeskTickets", () => {
  it("szuka po kliencie, gabinecie, sprzęcie, telefonie bez spacji, numerze i SN przyjętego zlecenia", () => {
    const linked = { [b.id]: [order] };
    expect(matchHelpdeskTickets([a, b], "gabinet", linked).map((t) => t.id)).toEqual([a.id]);
    expect(matchHelpdeskTickets([a, b], "lampa", linked).map((t) => t.id)).toEqual([b.id]);
    expect(matchHelpdeskTickets([a, b], "500000002", linked).map((t) => t.id)).toEqual([b.id]);
    expect(matchHelpdeskTickets([a, b], "#900001", linked).map((t) => t.id)).toEqual([a.id]);
    expect(matchHelpdeskTickets([a, b], "ab123", linked).map((t) => t.id)).toEqual([b.id]);
    expect(matchHelpdeskTickets([a, b], "anna lampa", linked).map((t) => t.id)).toEqual([b.id]);
    expect(matchHelpdeskTickets([a, b], "nic-takiego", linked)).toEqual([]);
  });

  it("puste szukanie zwraca wszystkie, bez przyjętego sprzętu najpierw", () => {
    expect(matchHelpdeskTickets([a, b], "", { [a.id]: [order] }).map((t) => t.id)).toEqual([b.id, a.id]);
  });
});

describe("sortTicketsForIntake", () => {
  it("zachowuje kolejność w grupach", () => {
    const c = { ...a, id: 3 };
    expect(sortTicketsForIntake([a, b, c], { [a.id]: [order] }).map((t) => t.id)).toEqual([b.id, 3, a.id]);
    expect(sortTicketsForIntake([a, b, c], { [a.id]: [] }).map((t) => t.id)).toEqual([a.id, b.id, 3]);
  });
});

describe("countTicketsWithoutOrders", () => {
  it("liczy zgłoszenia bez żadnego zlecenia", () => {
    expect(countTicketsWithoutOrders([a, b], { [a.id]: [order] })).toBe(1);
    expect(countTicketsWithoutOrders([a, b], {})).toBe(2);
  });
});

describe("inboundFromDelivery", () => {
  it("1 — klient wysyła, 2 — odbiór Mikranu, reszta nie ustalona", () => {
    expect(inboundFromDelivery(1)).toBe("kurier_klienta");
    expect(inboundFromDelivery(2)).toBe("odbior_mikran");
    expect(inboundFromDelivery(0)).toBeNull();
    expect(inboundFromDelivery(null)).toBeNull();
  });
});

describe("linkedOrderLine", () => {
  it("numer · sprzęt · SN, bez pustego SN", () => {
    expect(linkedOrderLine(order)).toBe("ZS/26/11/005 · Turbina · SN AB123");
    expect(linkedOrderLine({ ...order, serialNo: null })).toBe("ZS/26/11/005 · Turbina");
  });
});
