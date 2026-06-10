import { describe, expect, it } from "vitest";
import { notatnikZkWatchHref } from "./notatnik-zk-watch-href";

describe("notatnikZkWatchHref", () => {
  it("dodaje focusWatch i hash", () => {
    expect(notatnikZkWatchHref("w-1")).toBe("/notatnik?focusWatch=w-1#watch-w-1");
  });

  it("zachowuje podgląd ?dla=", () => {
    const href = notatnikZkWatchHref("w-1", {
      salesPersonId: "sp-9",
      previewDla: "sp-9",
    });
    expect(href).toContain("focusWatch=w-1");
    expect(href).toContain("dla=sp-9");
    expect(href).toContain("#watch-w-1");
  });
});
