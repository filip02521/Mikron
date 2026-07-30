import { describe, expect, it } from "vitest";
import {
  fingerprintForLineRematch,
  planLineKeyRematches,
} from "./rematch-line-keys";

describe("rematch-line-keys", () => {
  it("fingerprint preferuje towId", () => {
    expect(
      fingerprintForLineRematch({
        key: "ob:1",
        ob_TowId: 55,
        tw_Symbol: "SYM",
        tw_Nazwa: "Nazwa",
      })
    ).toBe("tow:55");
  });

  it("planuje 1:1 gdy ten sam towar, nowy klucz", () => {
    const plan = planLineKeyRematches(
      [
        {
          key: "ob:10",
          ob_TowId: 7,
          tw_Symbol: "A",
          tw_Nazwa: "Towar A",
        },
      ],
      [
        {
          key: "ob:99",
          ob_TowId: 7,
          tw_Symbol: "A",
          tw_Nazwa: "Towar A",
        },
      ]
    );
    expect(plan).toEqual([{ fromKey: "ob:10", toKey: "ob:99" }]);
  });

  it("nie rematchuje gdy ten sam towar jest dwa razy (niejednoznaczne)", () => {
    const plan = planLineKeyRematches(
      [
        { key: "ob:1", ob_TowId: 7, tw_Symbol: "A", tw_Nazwa: "A" },
        { key: "ob:2", ob_TowId: 7, tw_Symbol: "A", tw_Nazwa: "A" },
      ],
      [
        { key: "ob:3", ob_TowId: 7, tw_Symbol: "A", tw_Nazwa: "A" },
        { key: "ob:4", ob_TowId: 7, tw_Symbol: "A", tw_Nazwa: "A" },
      ]
    );
    expect(plan).toEqual([]);
  });

  it("rematch po symbolu gdy brak towId", () => {
    const plan = planLineKeyRematches(
      [{ key: "idx:0", ob_TowId: null, tw_Symbol: "XYZ", tw_Nazwa: "X" }],
      [{ key: "idx:1", ob_TowId: null, tw_Symbol: "XYZ", tw_Nazwa: "X" }]
    );
    expect(plan).toEqual([{ fromKey: "idx:0", toKey: "idx:1" }]);
  });
});
