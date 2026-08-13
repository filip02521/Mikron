import { describe, expect, it } from "vitest";
import { collectPalletLabels, groupByPallet } from "./group-by-pallet";
import { comparePalletLabels } from "./pallet-label-sort";
import type { ExternalWarehouseLineDto } from "./lines";

function line(
  key: string,
  palletLabel: string | null
): ExternalWarehouseLineDto {
  return {
    key,
    rowKey: key,
    symbol: null,
    product: key,
    quantity: 1,
    quantityLabel: "1 szt.",
    palletLabel,
    note: null,
  };
}

describe("comparePalletLabels", () => {
  it("sortuje numerycznie 1…12 (nie 1, 10, 11, 12, 2)", () => {
    const labels = ["1", "10", "11", "12", "2", "3", "9"];
    expect([...labels].sort(comparePalletLabels)).toEqual([
      "1",
      "2",
      "3",
      "9",
      "10",
      "11",
      "12",
    ]);
  });
});

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

  it("sortuje palety numerycznie", () => {
    const groups = groupByPallet([
      line("a", "10"),
      line("b", "2"),
      line("c", "1"),
      line("d", null),
    ]);
    expect(groups.map((g) => g.title)).toEqual(["1", "2", "10", "Bez palety"]);
  });

  it("collectPalletLabels zwraca unikalne posortowane", () => {
    expect(
      collectPalletLabels([line("1", "Z"), line("2", "A"), line("3", "A"), line("4", null)])
    ).toEqual(["A", "Z"]);
    expect(
      collectPalletLabels([
        line("1", "12"),
        line("2", "2"),
        line("3", "1"),
        line("4", "10"),
      ])
    ).toEqual(["1", "2", "10", "12"]);
  });
});
