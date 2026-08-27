import { describe, expect, it } from "vitest";
import type {
  ZdEstimateCechaOption,
  ZdEstimateGroupOption,
} from "@/app/actions/zd-estimate";
import {
  resolveZdEstimateFavoriteCechaChips,
  resolveZdEstimateFavoriteGroupChips,
  zdEstimateGroupOptionFromFavorite,
} from "./zd-estimate-scope-favorites";

const bareGroup = (id: number, name: string): ZdEstimateGroupOption => ({
  grt_Id: id,
  grt_Nazwa: name,
  supplierId: null,
  supplierName: null,
  dniZapasu: null,
  stockLabel: null,
  subiektKhId: null,
  additionalSubiektKhIds: [],
});

describe("zd-estimate-scope-favorites", () => {
  it("używa enrich gdy jest; inaczej cached label", () => {
    const fav = { id: 17, label: "Falcon" };
    const enriched = {
      ...bareGroup(17, "Falcon LIVE"),
      dniZapasu: 60,
      stockLabel: "2 mies.",
    };
    expect(zdEstimateGroupOptionFromFavorite(fav, enriched).dniZapasu).toBe(60);
    expect(zdEstimateGroupOptionFromFavorite(fav, null).grt_Nazwa).toBe(
      "Falcon"
    );
  });

  it("zachowuje kolejność ulubionych", () => {
    const map = new Map<number, ZdEstimateGroupOption>([
      [3, bareGroup(3, "C")],
      [1, bareGroup(1, "A")],
    ]);
    const chips = resolveZdEstimateFavoriteGroupChips(
      [
        { id: 1, label: "A" },
        { id: 2, label: "B-cache" },
        { id: 3, label: "C" },
      ],
      map
    );
    expect(chips.map((g) => g.grt_Id)).toEqual([1, 2, 3]);
    expect(chips[1]!.grt_Nazwa).toBe("B-cache");
  });

  it("cechy analogicznie", () => {
    const map = new Map<number, ZdEstimateCechaOption>([
      [
        9,
        {
          ctw_Id: 9,
          ctw_Nazwa: "Ivoclar",
          supplierId: null,
          supplierName: null,
          dniZapasu: 30,
          stockLabel: null,
          subiektKhId: null,
          additionalSubiektKhIds: [],
        },
      ],
    ]);
    expect(
      resolveZdEstimateFavoriteCechaChips([{ id: 9, label: "X" }], map)[0]
        ?.dniZapasu
    ).toBe(30);
  });
});
