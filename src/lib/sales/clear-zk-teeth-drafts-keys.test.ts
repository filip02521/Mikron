import { describe, expect, it } from "vitest";
import { resolveZkTeethDraftKeysToClear } from "./clear-zk-teeth-drafts-keys";

const drafts = {
  "ob:1": {
    lineKey: "ob:1",
    subiektTwId: 101,
    teethManufacturer: "ivoclar" as const,
    teethProductLine: "ivoclar_phonares_ii" as const,
    teethKind: "anterior" as const,
    expectedQuantity: 2,
    teethDetails: [],
    updatedAt: "2026-01-01T00:00:00Z",
  },
  "ob:2": {
    lineKey: "ob:2",
    subiektTwId: 202,
    teethManufacturer: "ivoclar" as const,
    teethProductLine: "ivoclar_phonares_ii" as const,
    teethKind: "posterior" as const,
    expectedQuantity: 4,
    teethDetails: [],
    updatedAt: "2026-01-01T00:00:00Z",
  },
};

describe("resolveZkTeethDraftKeysToClear", () => {
  it("preferuje jawne lineKeys", () => {
    expect(
      resolveZkTeethDraftKeysToClear({
        teethDrafts: drafts,
        teethTwIds: [101, 202],
        lineKeys: ["ob:1"],
      })
    ).toEqual(["ob:1"]);
  });

  it("czyści po twId draftu", () => {
    expect(
      resolveZkTeethDraftKeysToClear({
        teethDrafts: drafts,
        teethTwIds: [202],
      }).sort()
    ).toEqual(["ob:2"]);
  });

  it("czyści po twId linii ZK gdy draft ma inny twId", () => {
    expect(
      resolveZkTeethDraftKeysToClear({
        teethDrafts: drafts,
        teethTwIds: [999],
        viewTwIdByKey: new Map([
          ["ob:1", 999],
          ["ob:2", 202],
        ]),
      })
    ).toEqual(["ob:1"]);
  });
});
