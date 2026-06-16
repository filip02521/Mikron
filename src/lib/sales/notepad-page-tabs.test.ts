import { describe, expect, it } from "vitest";
import {
  buildNotatnikPageHref,
  isInvalidNotatnikTabParam,
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

  it("buildNotatnikPageHref dla notatek używa /notatnik bez zbędnego tab=notes", () => {
    expect(
      buildNotatnikPageHref({
        tab: "notes",
        hash: "note-n1",
      })
    ).toBe("/notatnik#note-n1");
  });

  it("buildNotatnikPageHref dla archiwum ZK używa /zk", () => {
    expect(
      buildNotatnikPageHref({
        tab: "archive",
        surface: "zk",
      })
    ).toBe("/zk?tab=archive");
  });

  it("buildNotatnikPageHref dla archiwum notatek używa /notatnik", () => {
    expect(
      buildNotatnikPageHref({
        tab: "archive",
        surface: "notes",
      })
    ).toBe("/notatnik?tab=archive");
  });

  it("resolveNotatnikPageTab respektuje defaultTab", () => {
    expect(resolveNotatnikPageTab({ defaultTab: "notes" })).toBe("notes");
    expect(resolveNotatnikPageTab({ defaultTab: "zk" })).toBe("zk");
  });

  it("resolveNotatnikPageTab omija puste archiwum", () => {
    expect(
      resolveNotatnikPageTab({
        tabParam: "archive",
        defaultTab: "notes",
        archiveAvailable: false,
      })
    ).toBe("notes");
  });

  it("isSalesZkNavPath obejmuje /zk i /notatnik", () => {
    expect(isSalesZkNavPath("/zk")).toBe(true);
    expect(isSalesZkNavPath("/notatnik")).toBe(true);
    expect(isSalesZkNavPath("/moje")).toBe(false);
  });

  it("isInvalidNotatnikTabParam wykrywa nieznane taby", () => {
    expect(isInvalidNotatnikTabParam("archive")).toBe(false);
    expect(isInvalidNotatnikTabParam("foo")).toBe(true);
    expect(isInvalidNotatnikTabParam(null)).toBe(false);
  });
});
