import { describe, expect, it } from "vitest";
import {
  formatTeethQueueWaitLabel,
  oldestTeethQueueEnteredAt,
  resolveTeethQueueEnteredAt,
  teethQueueWaitCalendarDays,
} from "@/lib/teeth/teeth-queue-wait";

describe("teeth-queue-wait", () => {
  it("preferuje teeth_queue_entered_at", () => {
    expect(
      resolveTeethQueueEnteredAt({
        teeth_queue_entered_at: "2026-03-10T08:00:00Z",
        created_at: "2026-03-01T08:00:00Z",
        action_at: "2026-03-02T08:00:00Z",
      }),
    ).toBe("2026-03-10T08:00:00Z");
  });

  it("fallback na created_at i action_at", () => {
    expect(
      resolveTeethQueueEnteredAt({
        teeth_queue_entered_at: null,
        created_at: "2026-03-01T08:00:00Z",
        action_at: "2026-03-02T08:00:00Z",
      }),
    ).toBe("2026-03-01T08:00:00Z");

    expect(
      resolveTeethQueueEnteredAt({
        teeth_queue_entered_at: null,
        action_at: "2026-03-02T08:00:00Z",
      }),
    ).toBe("2026-03-02T08:00:00Z");
  });

  it("liczy dni kalendarzowe w Warszawie", () => {
    expect(
      teethQueueWaitCalendarDays(
        "2026-03-10T08:00:00Z",
        new Date("2026-03-12T20:00:00Z"),
      ),
    ).toBe(2);
  });

  it("formatuje etykietę oczekiwania", () => {
    const label = formatTeethQueueWaitLabel(
      { teeth_queue_entered_at: "2026-03-10T08:00:00Z" },
      new Date("2026-03-12T20:00:00Z"),
    );
    expect(label).toMatch(/^od /);
    expect(label).toContain("2 dni");
  });

  it("zwraca najstarsze wejście w grupie", () => {
    expect(
      oldestTeethQueueEnteredAt([
        { teeth_queue_entered_at: "2026-03-12T08:00:00Z" },
        { teeth_queue_entered_at: "2026-03-08T08:00:00Z" },
        { action_at: "2026-03-15T08:00:00Z" },
      ]),
    ).toBe("2026-03-08T08:00:00Z");
  });
});
