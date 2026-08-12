import { describe, expect, it } from "vitest";
import {
  resolveZkProsbaPrefillSalesPersonAccess,
  ZK_PROSBA_PREFILL_OWN_REQUIRED,
} from "./zk-prosba-prefill-access";

describe("resolveZkProsbaPrefillSalesPersonAccess", () => {
  it("sales — własna karta OK (nawet gdy canAccessRequested=false)", () => {
    expect(
      resolveZkProsbaPrefillSalesPersonAccess({
        role: "sales",
        ownSalesPersonId: "stan",
        requestedSalesPersonId: "stan",
        canAccessRequested: false,
      })
    ).toEqual({ ok: true });
  });

  it("sales — cudza karta zablokowana", () => {
    expect(
      resolveZkProsbaPrefillSalesPersonAccess({
        role: "sales",
        ownSalesPersonId: "stan",
        requestedSalesPersonId: "inna",
        canAccessRequested: true,
      })
    ).toEqual({ ok: false, message: ZK_PROSBA_PREFILL_OWN_REQUIRED });
  });

  it("sales_manager — cudza karta gdy canAccessRequested", () => {
    expect(
      resolveZkProsbaPrefillSalesPersonAccess({
        role: "sales_manager",
        ownSalesPersonId: "mgr",
        requestedSalesPersonId: "handl",
        canAccessRequested: true,
      })
    ).toEqual({ ok: true });
  });

  it("sales_manager — cudza karta bez dostępu", () => {
    expect(
      resolveZkProsbaPrefillSalesPersonAccess({
        role: "sales_manager",
        ownSalesPersonId: "mgr",
        requestedSalesPersonId: "handl",
        canAccessRequested: false,
      })
    ).toEqual({ ok: false, message: ZK_PROSBA_PREFILL_OWN_REQUIRED });
  });
});
