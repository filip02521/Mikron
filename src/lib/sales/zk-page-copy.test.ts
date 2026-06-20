import { describe, expect, it } from "vitest";
import { ZK_KEYBOARD_HINTS, ZK_PAGE_SECTION_COPY, formatZkUnseenRegalBadge } from "./zk-page-copy";

describe("zk-page-copy", () => {
  it("ma copy sekcji listy i dodawania", () => {
    expect(ZK_PAGE_SECTION_COPY.listTitle).toContain("lista");
    expect(ZK_PAGE_SECTION_COPY.addDescription).toContain("nie filtruje");
  });

  it("ma skróty wyszukiwania", () => {
    const hints = [...ZK_KEYBOARD_HINTS];
    expect(hints.some((item) => item.keys[0] === "/")).toBe(true);
    expect(hints.some((item) => item.keys[0] === "Esc")).toBe(true);
  });

  it("rozróżnia badge nieodczytanych ZK od licznika pozycji na regale", () => {
    expect(formatZkUnseenRegalBadge(1)).toContain("ZK");
    expect(formatZkUnseenRegalBadge(1)).toContain("nowy towar");
    expect(formatZkUnseenRegalBadge(3)).toBe("3 ZK — nowy towar na regale");
  });
});
