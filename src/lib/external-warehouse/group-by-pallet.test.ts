import { describe, expect, it } from "vitest";
import { collectPalletLabels, groupByPallet } from "./group-by-pallet";
import type { ExternalWarehouseLineDto } from "./lines";

function line(
  key: string,
  palletLabel: string | null
): ExternalWarehouseLineDto {
  return {
    key,
    symbol: null,
    product: key,
    quantity: 1,
    quantityLabel: "1 szt.",
    palletLabel,
    note: null,
  };
}

describe("groupByPallet", () => {
  it("sortuje palety A–Z i Bez palety na końcu", () => {
    const groups = groupByPallet([
      line("1", "B"),
      line("2", null),
      line("3", "A"),
      line("4", "A"),
    ]);
    expect(groups.map((g) => g.title)).toEqual(["A", "B", "Bez palety"]);
    expect(groups[0]?.lines).toHaveLength(2);
  });

  it("collectPalletLabels zwraca unikalne posortowane", () => {
    expect(
      collectPalletLabels([line("1", "Z"), line("2", "A"), line("3", "A"), line("4", null)])
    ).toEqual(["A", "Z"]);
  });
});
