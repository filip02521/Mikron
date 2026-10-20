import { describe, expect, it } from "vitest";
import { fetchAllRows } from "./fetch-all-rows";

function fakeTable(total: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i + 1 }));
  const calls: Array<[number, number]> = [];
  const build = () => ({
    range: async (from: number, to: number) => {
      calls.push([from, to]);
      return { data: rows.slice(from, to + 1), error: null };
    },
  });
  return { build, calls };
}

describe("fetchAllRows", () => {
  it("zbiera wiersze ponad limit strony (bez cichego ucięcia na 1000)", async () => {
    const { build, calls } = fakeTable(2350);
    const out = await fetchAllRows<{ id: number }>(build);
    expect(out).toHaveLength(2350);
    expect(out.at(-1)).toEqual({ id: 2350 });
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("dokładnie pełna strona → jeszcze jedno (puste) zapytanie", async () => {
    const { build, calls } = fakeTable(4);
    expect(await fetchAllRows(build, 2)).toHaveLength(4);
    expect(calls).toHaveLength(3);
  });

  it("błąd strony → throw", async () => {
    const build = () => ({
      range: async () => ({ data: null, error: { message: "boom" } }),
    });
    await expect(fetchAllRows(build)).rejects.toThrow("boom");
  });
});
