import { describe, expect, it } from "vitest";
import { pickZkWatchRowColorLegendItems } from "./zk-watch-row-color-legend";

describe("pickZkWatchRowColorLegendItems", () => {
  it("compact — zawsze pokazuje core", () => {
    const items = pickZkWatchRowColorLegendItems({ compact: true });
    expect(items.map((item) => item.id)).toEqual(["regal", "ready_to_close"]);
  });

  it("compact — dodaje kontekstowe kolory", () => {
    const items = pickZkWatchRowColorLegendItems({
      compact: true,
      informacjaReadyLineCount: 2,
      followUpCount: 1,
    });
    expect(items.map((item) => item.id)).toEqual([
      "regal",
      "ready_to_close",
      "informacja",
      "follow_up",
    ]);
  });

  it("full — wszystkie pozycje", () => {
    expect(pickZkWatchRowColorLegendItems({ compact: false })).toHaveLength(5);
  });

  it("compact — dodaje nowe pozycje gdy są na liście", () => {
    const items = pickZkWatchRowColorLegendItems({
      compact: true,
      newLinesWatchCount: 2,
    });
    expect(items.map((item) => item.id)).toContain("new_lines");
  });
});
