import { describe, expect, it } from "vitest";
import { quoteWaitingDays, serviceOrderLane, serviceOrderNowReason, serviceOrderStamps } from "@/lib/orders/service-order-board";
import type { ServiceOrderStatus } from "@/lib/orders/service-orders";

const today = new Date(2026, 10, 6);
const order = (status: ServiceOrderStatus, extra: Partial<{ dueDate: string | null; rwNumber: string | null; fsNumber: string | null; noInvoiceReason: string | null }> = {}) => ({
  status,
  dueDate: null,
  rwNumber: null,
  fsNumber: null,
  noInvoiceReason: null,
  createdAt: "2026-11-01T08:00:00.000Z",
  ...extra,
});
const ev = (type: "created" | "status", toStatus: ServiceOrderStatus | null, at: string) => ({ type, toStatus, at, actorName: "serwis.test" });

describe("serviceOrderLane", () => {
  it("część na stanie albo termin po czasie → teraz; gotowe → do wydania", () => {
    expect(serviceOrderLane(order("czeka_na_czesc"), [], { arrived: true, today })).toBe("teraz");
    expect(serviceOrderLane(order("w_naprawie", { dueDate: "2026-11-05" }), [], { arrived: false, today })).toBe("teraz");
    expect(serviceOrderLane(order("gotowe", { dueDate: "2026-11-01" }), [], { arrived: false, today })).toBe("do_wydania");
    expect(serviceOrderLane(order("czeka_na_czesc"), [], { arrived: false, today })).toBe("czeka");
    expect(serviceOrderLane(order("diagnoza", { dueDate: "2026-11-06" }), [], { arrived: false, today })).toBe("w_naprawie");
  });

  it("zamknięte: brak dokumentów albo archiwum", () => {
    expect(serviceOrderLane(order("wydane"), [{ quantity: 1 }], { arrived: false, today })).toBe("dokumenty");
    expect(serviceOrderLane(order("wydane", { rwNumber: "RW 1", fsNumber: "FS 1" }), [{ quantity: 1 }], { arrived: false, today })).toBe("zamkniete");
    expect(serviceOrderNowReason(order("anulowane", { dueDate: "2026-01-01" }), { arrived: true, today })).toBeNull();
  });
});

describe("serviceOrderStamps", () => {
  it("droga z pominiętą diagnozą i bieżącą naprawą", () => {
    const s = serviceOrderStamps(order("w_naprawie"), [ev("created", "przyjete", "2026-11-01T08:00:00Z"), ev("status", "w_naprawie", "2026-11-02T09:00:00Z")]);
    expect(s.map((x) => x.state)).toEqual(["done", "skipped", "current", "empty", "empty"]);
    expect(s[2]!.at).toBe("2026-11-02T09:00:00Z");
  });

  it("czeka na część: rubryka Naprawa w stanie czekania", () => {
    const s = serviceOrderStamps(order("czeka_na_czesc"), [ev("created", null, "2026-11-01T08:00:00Z"), ev("status", "diagnoza", "2026-11-01T10:00:00Z"), ev("status", "w_naprawie", "2026-11-02T10:00:00Z"), ev("status", "czeka_na_czesc", "2026-11-03T10:00:00Z")]);
    expect(s.map((x) => x.state)).toEqual(["done", "done", "waiting", "empty", "empty"]);
  });

  it("cofnięcie z gotowe do naprawy czyści rubrykę Gotowe, ponowne wejście daje nową datę", () => {
    const events = [ev("created", null, "2026-11-01T08:00:00Z"), ev("status", "w_naprawie", "2026-11-02T08:00:00Z"), ev("status", "gotowe", "2026-11-03T08:00:00Z"), ev("status", "w_naprawie", "2026-11-04T08:00:00Z")];
    const back = serviceOrderStamps(order("w_naprawie"), events);
    expect(back[3]).toMatchObject({ state: "empty", at: null });
    expect(back[2]!.at).toBe("2026-11-04T08:00:00Z");
  });

  it("wydane: wszystkie rubryki przybite; anulowane: do ostatniego osiągniętego kroku", () => {
    const all = [ev("created", null, "2026-11-01T08:00:00Z"), ev("status", "diagnoza", "2026-11-01T09:00:00Z"), ev("status", "w_naprawie", "2026-11-01T10:00:00Z"), ev("status", "gotowe", "2026-11-02T10:00:00Z"), ev("status", "wydane", "2026-11-03T10:00:00Z")];
    expect(serviceOrderStamps(order("wydane"), all).every((x) => x.state === "done")).toBe(true);
    const cancelled = serviceOrderStamps(order("anulowane"), all.slice(0, 2));
    expect(cancelled.map((x) => x.state)).toEqual(["done", "done", "empty", "empty", "empty"]);
  });

  it("bez zdarzenia „created” bierze datę przyjęcia zlecenia", () => {
    expect(serviceOrderStamps(order("przyjete"), [])[0]).toMatchObject({ state: "current", at: "2026-11-01T08:00:00.000Z" });
  });
});

describe("wycena i decyzja klienta", () => {
  const quoted = (sentAt: string) => ({ ...order("czeka_na_akceptacje"), quote: { sentAt } });

  it("czeka na klienta; po 3 dniach milczenia → teraz z powodem „klient”", () => {
    expect(serviceOrderLane(quoted("2026-11-05T10:00:00Z"), [], { arrived: false, today })).toBe("klient");
    expect(serviceOrderLane(quoted("2026-11-03T10:00:00Z"), [], { arrived: false, today })).toBe("teraz");
    expect(serviceOrderNowReason(quoted("2026-11-03T10:00:00Z"), { arrived: false, today })).toBe("klient");
    expect(quoteWaitingDays("2026-11-03T23:00:00", today)).toBe(3);
  });

  it("rubryka Diagnoza czeka na klienta, Naprawa jeszcze pusta", () => {
    const s = serviceOrderStamps(order("czeka_na_akceptacje"), [ev("created", null, "2026-11-01T08:00:00Z"), ev("status", "diagnoza", "2026-11-02T08:00:00Z"), ev("status", "czeka_na_akceptacje", "2026-11-03T08:00:00Z")]);
    expect(s.map((x) => x.state)).toEqual(["done", "waiting", "empty", "empty", "empty"]);
    expect(s[1]!.waitingFor).toBe("klient");
    expect(serviceOrderStamps(order("czeka_na_czesc"), [])[2]!.waitingFor).toBe("czesc");
  });
});
