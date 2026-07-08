import { describe, expect, it } from "vitest";
import {
  computeNotificationFlushDelay,
  createDeliveryNotificationFlushScheduler,
} from "@/lib/client/delivery-notification-flush-scheduler";

function createTestScheduler(onFlush: (queueId: string) => void, now: () => number) {
  let nextId = 1;
  const timers = new Map<number, { fn: () => void; at: number }>();

  return {
    scheduler: createDeliveryNotificationFlushScheduler({
      now,
      setTimer: (fn, delayMs) => {
        const id = nextId++;
        timers.set(id, { fn, at: now() + delayMs });
        return id;
      },
      clearTimer: (id) => {
        timers.delete(id);
      },
      onFlush,
    }),
    fireDueTimers() {
      const t = now();
      for (const [id, entry] of [...timers.entries()]) {
        if (entry.at <= t) {
          timers.delete(id);
          entry.fn();
        }
      }
    },
  };
}

describe("delivery-notification-flush-scheduler", () => {
  it("computeNotificationFlushDelay — minimum 250 ms po expiresAt", () => {
    expect(computeNotificationFlushDelay(10_000, 10_000)).toBe(250);
    expect(computeNotificationFlushDelay(10_000, 9_000)).toBe(1_250);
    expect(computeNotificationFlushDelay(5_000, 10_000)).toBe(250);
  });

  it("schedule — uruchamia flush per queueId po opóźnieniu", () => {
    let clock = 1_000;
    const flushed: string[] = [];
    const { scheduler, fireDueTimers } = createTestScheduler(
      (queueId) => flushed.push(queueId),
      () => clock
    );

    scheduler.schedule({ queueIds: ["q1", "q2"], expiresAt: 11_000 });
    expect(flushed).toEqual([]);

    clock = 11_250;
    fireDueTimers();
    expect(flushed).toEqual(["q1", "q2"]);
  });

  it("schedule — ponowne planowanie tego samego queueId resetuje timer", () => {
    let clock = 1_000;
    const flushed: string[] = [];
    const { scheduler, fireDueTimers } = createTestScheduler(
      (queueId) => flushed.push(queueId),
      () => clock
    );

    scheduler.schedule({ queueIds: ["q1"], expiresAt: 5_000 });
    clock = 4_000;
    scheduler.schedule({ queueIds: ["q1"], expiresAt: 20_000 });

    clock = 9_000;
    fireDueTimers();
    expect(flushed).toEqual([]);

    clock = 20_500;
    fireDueTimers();
    expect(flushed).toEqual(["q1"]);
  });

  it("cancel — anuluje zaplanowany flush bez wysyłki", () => {
    let clock = 0;
    const flushed: string[] = [];
    const { scheduler, fireDueTimers } = createTestScheduler(
      (queueId) => flushed.push(queueId),
      () => clock
    );

    scheduler.schedule({ queueIds: ["q1", "q2"], expiresAt: 10_000 });
    scheduler.cancel(["q1"]);
    clock = 10_500;
    fireDueTimers();
    expect(flushed).toEqual(["q2"]);
  });

  it("brak cancel po zamknięciu undo — timer nadal wysyła mail", () => {
    let clock = 0;
    const flushed: string[] = [];
    const { scheduler, fireDueTimers } = createTestScheduler(
      (queueId) => flushed.push(queueId),
      () => clock
    );

    scheduler.schedule({ queueIds: ["batch-a"], expiresAt: 10_000 });
    clock = 10_500;
    fireDueTimers();
    expect(flushed).toEqual(["batch-a"]);
  });
});
