import { describe, expect, it } from "vitest";
import { findZkWatchByNumber } from "./find-zk-watch-by-number";

describe("findZkWatchByNumber", () => {
  const watches = [
    { zk_number: "ZK 153157/M/04/2026" },
    { zk_number: "ZK/2026/0999" },
  ];

  it("znajduje po dokładnym numerze", () => {
    expect(findZkWatchByNumber(watches, "ZK/2026/0999")?.zk_number).toBe(
      "ZK/2026/0999"
    );
  });

  it("znajduje po równoważnym formacie (bez prefiksu ZK)", () => {
    expect(findZkWatchByNumber(watches, "153157/M/04/2026")?.zk_number).toBe(
      "ZK 153157/M/04/2026"
    );
  });
});
