import { describe, expect, it } from "vitest";
import {
  formatZkProsbaSupplementDetail,
  ZK_PROSBA_LINK_BANNER_COPY,
} from "./zk-prosba-link-banner-copy";

describe("ZK_PROSBA_LINK_BANNER_COPY", () => {
  it("ma wyraźne sygnały kontekstu ZK", () => {
    expect(ZK_PROSBA_LINK_BANNER_COPY.badge).toMatch(/ZK/i);
    expect(ZK_PROSBA_LINK_BANNER_COPY.formTitle).toMatch(/ZK/i);
    expect(ZK_PROSBA_LINK_BANNER_COPY.titleFull).toMatch(/prośb/i);
    expect(ZK_PROSBA_LINK_BANNER_COPY.titleSupplement).toMatch(/Uzupełniająca/i);
  });

  it("formatZkProsbaSupplementDetail — odmiana i katalog", () => {
    expect(formatZkProsbaSupplementDetail(1, true)).toBe(
      "1 nowa pozycja z ZK. Wcześniejsze pozycje są już w zamówieniu. Możesz dodać tylko produkty z tego ZK."
    );
    expect(formatZkProsbaSupplementDetail(3, true)).toContain("3 nowe pozycje");
    expect(formatZkProsbaSupplementDetail(5, false)).toBe(
      "5 nowych pozycji z ZK. Wcześniejsze pozycje są już w zamówieniu."
    );
  });
});
