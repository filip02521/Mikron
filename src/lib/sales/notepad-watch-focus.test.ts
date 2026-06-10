import { describe, expect, it } from "vitest";
import { resolveWatchFocusRequest } from "./notepad-watch-focus";
import type { SalesZkWatch } from "@/types/database";

function watch(id: string): SalesZkWatch {
  return { id } as SalesZkWatch;
}

describe("resolveWatchFocusRequest", () => {
  it("znajduje aktywną ZK", () => {
    expect(resolveWatchFocusRequest("w1", [watch("w1")], [])).toEqual({
      kind: "found",
      showZk: true,
      showArchive: false,
    });
  });

  it("znajduje ZK w archiwum", () => {
    expect(resolveWatchFocusRequest("w2", [], [watch("w2")])).toEqual({
      kind: "found",
      showZk: false,
      showArchive: true,
    });
  });

  it("zwraca missing gdy brak ZK", () => {
    expect(resolveWatchFocusRequest("w9", [watch("w1")], [])).toEqual({ kind: "missing" });
  });
});
