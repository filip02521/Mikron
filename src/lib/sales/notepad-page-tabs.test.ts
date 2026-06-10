import { describe, expect, it } from "vitest";
import {
  buildNotatnikPageHref,
  isSalesZkNavPath,
  resolveNotatnikPageTab,
} from "./notepad-page-tabs";

describe("notepad-page-tabs", () => {
  it("resolveNotatnikPageTab domyślnie ZK", () => {
    expect(resolveNotatnikPageTab({})).toBe("zk");
  });

  it("resolveNotatnikPageTab po hash notatki", () => {
    expect(resolveNotatnikPageTab({ hash: "#note-abc" })).toBe("notes");
  });

  it("resolveNotatnikPageTab po focusWatch w archiwum", () => {
    expect(
      resolveNotatnikPageTab({
        focusWatchId: "w-arch",
        watchInOpen: false,
        watchInArchive: true,
      })
    ).toBe("archive");
  });

  it("buildNotatnikPageHref dla ZK używa /zk", () => {
    expect(
      buildNotatnikPageHref({
        focusWatch: "w-1",
      })
    ).toBe("/zk?focusWatch=w-1#watch-w-1");
  });

  it("buildNotatnikPageHref dla notatek używa /notatnik?tab=notes", () => {
    expect(
      buildNotatnikPageHref({
        tab: "notes",
        hash: "note-n1",
      })
    ).toBe("/notatnik?tab=notes#note-n1");
  });

  it("isSalesZkNavPath obejmuje /zk i /notatnik", () => {
    expect(isSalesZkNavPath("/zk")).toBe(true);
    expect(isSalesZkNavPath("/notatnik")).toBe(true);
    expect(isSalesZkNavPath("/moje")).toBe(false);
  });
});
