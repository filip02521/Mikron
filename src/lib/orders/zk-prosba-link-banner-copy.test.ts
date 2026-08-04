import { describe, expect, it } from "vitest";
import { ZK_PROSBA_LINK_BANNER_COPY } from "./zk-prosba-link-banner-copy";

describe("ZK_PROSBA_LINK_BANNER_COPY", () => {
  it("ma wyraźne sygnały kontekstu ZK", () => {
    expect(ZK_PROSBA_LINK_BANNER_COPY.badge).toMatch(/ZK/i);
    expect(ZK_PROSBA_LINK_BANNER_COPY.formTitle).toMatch(/ZK/i);
    expect(ZK_PROSBA_LINK_BANNER_COPY.leadCreating).toMatch(/powiązan/i);
  });
});
