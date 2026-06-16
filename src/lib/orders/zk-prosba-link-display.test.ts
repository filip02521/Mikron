import { describe, expect, it } from "vitest";
import {
  buildNotatnikZkWatchHref,
  formatProsbaZkLinkNumber,
} from "./zk-prosba-link-display";

describe("formatProsbaZkLinkNumber", () => {
  it("usuwa prefiks ZK z numeru", () => {
    expect(formatProsbaZkLinkNumber("ZK/2026/0138")).toBe("2026/0138");
    expect(formatProsbaZkLinkNumber("ZK 153157/M/04/2026")).toBe("153157/M/04/2026");
  });
});

describe("buildNotatnikZkWatchHref", () => {
  it("linkuje do karty ZK w notatniku z parametrem focusWatch", () => {
    expect(buildNotatnikZkWatchHref({ zkWatchId: "w-1" })).toBe(
      "/zk?focusWatch=w-1#watch-w-1"
    );
    expect(
      buildNotatnikZkWatchHref({
        zkWatchId: "w-1",
        salesPersonId: "sp-9",
        preview: true,
      })
    ).toBe("/zk?dla=sp-9&focusWatch=w-1#watch-w-1");
  });

  it("linkuje do archiwum ZK gdy sprawa zamknięta", () => {
    expect(buildNotatnikZkWatchHref({ zkWatchId: "w-arch", archived: true })).toBe(
      "/zk?focusWatch=w-arch&tab=archive#watch-w-arch"
    );
  });
});
