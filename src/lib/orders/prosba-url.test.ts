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

  it("resolveProsbaSupplierId odrzuca nieznane id", () => {
    expect(resolveProsbaSupplierId("s1", ["s1", "s2"])).toBe("s1");
    expect(resolveProsbaSupplierId("x", ["s1"])).toBeUndefined();
  });
});
