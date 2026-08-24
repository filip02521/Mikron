import { describe, expect, it, vi } from "vitest";
import { mapPool } from "@/lib/async/map-pool";

describe("mapPool", () => {
  it("zachowuje kolejność wyników przy równoległym kończeniu", async () => {
    const started: number[] = [];
    const delays = [40, 5, 20, 10];
    const out = await mapPool([0, 1, 2, 3], 2, async (item) => {
      started.push(item);
      await new Promise((r) => setTimeout(r, delays[item]!));
      return item * 10;
    });
    expect(out).toEqual([0, 10, 20, 30]);
    expect(started[0]).toBe(0);
    expect(started[1]).toBe(1);
  });

  it("pusta lista → []", async () => {
    const fn = vi.fn();
    await expect(mapPool([], 4, fn)).resolves.toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it("limit > length nie startuje zbędnych workerów", async () => {
    let active = 0;
    let maxActive = 0;
    await mapPool([1, 2, 3], 10, async (n) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 15));
      active -= 1;
      return n;
    });
    expect(maxActive).toBe(3);
  });

  it("propaguje błąd z fn", async () => {
    await expect(
      mapPool([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      })
    ).rejects.toThrow("boom");
  });

  it("po błędzie nie startuje kolejnych zadań", async () => {
    const started: number[] = [];
    await expect(
      mapPool([1, 2, 3, 4, 5], 2, async (n) => {
        started.push(n);
        if (n === 1) {
          await new Promise((r) => setTimeout(r, 5));
          throw new Error("fail-early");
        }
        await new Promise((r) => setTimeout(r, 40));
        return n;
      })
    ).rejects.toThrow("fail-early");
    // 1 i 2 startują razem; 3+ nie powinny wejść po abort
    expect(started.includes(1)).toBe(true);
    expect(started.some((n) => n >= 3)).toBe(false);
  });
});
