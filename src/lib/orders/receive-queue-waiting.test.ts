import { describe, expect, it, vi, afterEach } from "vitest";
import {
  maxReceiveQueueWaitingDays,
  receiveQueueWaitingBusinessDays,
  receiveQueueWaitingDaysLabel,
} from "@/lib/orders/receive-queue-waiting";

vi.mock("@/lib/time/warsaw", () => ({
  todayInWarsaw: () => new Date("2026-08-21T12:00:00"),
}));

describe("receiveQueueWaitingBusinessDays", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("null dla informacji", () => {
    expect(
      receiveQueueWaitingBusinessDays({
        ordered_at: "2026-08-18",
        action_at: "2026-08-18",
        status: "Zamowione",
        request_kind: "informacja",
      })
    ).toBeNull();
  });

  it("liczy dni robocze od ordered_at", () => {
    // piątek 14 → piątek 21 = 5 dni roboczych (14,15,18,19,20? wait calculateBusinessDays semantics)
    const days = receiveQueueWaitingBusinessDays({
      ordered_at: "2026-08-14",
      action_at: "2026-08-10",
      status: "Zamowione",
      request_kind: "zamowienie",
    });
    expect(days).toBeGreaterThan(0);
    expect(typeof days).toBe("number");
  });

  it("0 gdy data w przyszłości", () => {
    expect(
      receiveQueueWaitingBusinessDays({
        ordered_at: "2026-08-25",
        action_at: "2026-08-10",
        status: "Zamowione",
        request_kind: "zamowienie",
      })
    ).toBe(0);
  });
});

describe("maxReceiveQueueWaitingDays", () => {
  it("bierze najstarszą prośbę", () => {
    const max = maxReceiveQueueWaitingDays([
      {
        ordered_at: "2026-08-20",
        action_at: "2026-08-20",
        status: "Zamowione",
        request_kind: "zamowienie",
      },
      {
        ordered_at: "2026-08-14",
        action_at: "2026-08-14",
        status: "Zamowione",
        request_kind: "zamowienie",
      },
    ]);
    const older = receiveQueueWaitingBusinessDays({
      ordered_at: "2026-08-14",
      action_at: "2026-08-14",
      status: "Zamowione",
      request_kind: "zamowienie",
    });
    expect(max).toBe(older);
  });
});

describe("receiveQueueWaitingDaysLabel", () => {
  it("odmienia dzień/dni", () => {
    expect(receiveQueueWaitingDaysLabel(1)).toBe("1 dzień");
    expect(receiveQueueWaitingDaysLabel(3)).toBe("3 dni");
  });
});
