import { describe, expect, it } from "vitest";
import { prosbaHref, resolveProsbaSupplierId } from "./prosba-url";

describe("prosba-url", () => {
  it("prosbaHref buduje query dla dostawcy i handlowca", () => {
    expect(prosbaHref({ supplierId: "s1" })).toBe("/prosba?dostawca=s1");
    expect(prosbaHref({ salesPersonId: "sp1", supplierId: "s1" })).toBe(
      "/prosba?dla=sp1&dostawca=s1"
    );
    expect(prosbaHref()).toBe("/prosba");
  });

  it("prosbaHref obsługuje prefill z ZK", () => {
    expect(
      prosbaHref({
        salesPersonId: "sp1",
        fromZk: true,
        zkWatchId: "watch-uuid",
        zk: "ZK/2026/0138",
        klient: "Klinika Smile",
        clientKhId: 42,
      })
    ).toBe(
      "/prosba?dla=sp1&fromZk=1&zkWatch=watch-uuid&zk=ZK%2F2026%2F0138&klient=Klinika+Smile&kh=42"
    );
  });

  it("prosbaHref przekazuje rodzaj informacji z ZK", () => {
    expect(
      prosbaHref({
        salesPersonId: "sp1",
        fromZk: true,
        zkWatchId: "watch-uuid",
        zkLineKeys: ["a", "b"],
        requestKind: "informacja",
      })
    ).toBe(
      "/prosba?dla=sp1&fromZk=1&zkWatch=watch-uuid&zkLines=a%2Cb&rodzaj=informacja"
    );
  });

  it("resolveProsbaSupplierId odrzuca nieznane id", () => {
    expect(resolveProsbaSupplierId("s1", ["s1", "s2"])).toBe("s1");
    expect(resolveProsbaSupplierId("x", ["s1"])).toBeUndefined();
  });
});
