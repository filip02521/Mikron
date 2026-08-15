import { describe, expect, it } from "vitest";
import {
  buildZdEstimateNameMetaOverflowTitle,
  compareZdEstimateNameMetaPriority,
  resolveZdEstimateNameMetaStatus,
  sortZdEstimateNameMetaCandidates,
} from "@/lib/orders/zd-estimate-name-meta-priority";

describe("zd-estimate-name-meta-priority", () => {
  it("orders exclude-tier > individual > pair > bom", () => {
    expect(compareZdEstimateNameMetaPriority("excluded", "individual")).toBeLessThan(
      0
    );
    expect(
      compareZdEstimateNameMetaPriority("name_auto_exclude", "pair")
    ).toBeLessThan(0);
    expect(
      compareZdEstimateNameMetaPriority("soft_on_request", "individual")
    ).toBeLessThan(0);
    expect(compareZdEstimateNameMetaPriority("individual", "pair")).toBeLessThan(
      0
    );
    expect(compareZdEstimateNameMetaPriority("pair", "bom")).toBeLessThan(0);
  });

  it("sorts candidates by priority, stable on ties", () => {
    const sorted = sortZdEstimateNameMetaCandidates([
      { kind: "bom" as const, id: "b1" },
      { kind: "pair" as const, id: "p1" },
      { kind: "individual" as const, id: "i1" },
      { kind: "excluded" as const, id: "e1" },
    ]);
    expect(sorted.map((s) => s.id)).toEqual(["e1", "i1", "p1", "b1"]);
  });

  it("resolves mutually exclusive status chips like workbench", () => {
    expect(
      resolveZdEstimateNameMetaStatus({
        excluded: true,
        sessionIncluded: true,
        hasNameAutoExclude: true,
        softOnRequest: true,
        liftedExtraOnly: true,
      })?.kind
    ).toBe("session_include");

    expect(
      resolveZdEstimateNameMetaStatus({
        excluded: true,
        sessionIncluded: false,
        hasNameAutoExclude: true,
        softOnRequest: false,
        liftedExtraOnly: false,
      })?.kind
    ).toBe("name_auto_exclude");

    expect(
      resolveZdEstimateNameMetaStatus({
        excluded: true,
        sessionIncluded: false,
        hasNameAutoExclude: false,
        softOnRequest: true,
        liftedExtraOnly: false,
      })?.kind
    ).toBe("soft_on_request");

    expect(
      resolveZdEstimateNameMetaStatus({
        excluded: true,
        sessionIncluded: false,
        hasNameAutoExclude: false,
        softOnRequest: false,
        liftedExtraOnly: false,
      })?.kind
    ).toBe("excluded");

    expect(
      resolveZdEstimateNameMetaStatus({
        excluded: false,
        sessionIncluded: false,
        hasNameAutoExclude: false,
        softOnRequest: false,
        liftedExtraOnly: false,
      })
    ).toBeNull();
  });

  it("builds overflow tooltip", () => {
    const title = buildZdEstimateNameMetaOverflowTitle([
      { kind: "pair", summary: "Paczka · na ZD" },
      { kind: "bom", summary: "Skład · składnik" },
    ]);
    expect(title).toContain("Jeszcze 2");
    expect(title).toContain("Paczka · na ZD");
    expect(title).toContain("Skład · składnik");
  });
});
