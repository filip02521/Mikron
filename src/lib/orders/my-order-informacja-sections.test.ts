import { describe, expect, it } from "vitest";
import { testMyOrderRow } from "@/test-utils/fixtures";
import {
  informacjaProgressPhase,
  partitionInformacjaProgressRows,
} from "./my-order-informacja-sections";

function row(statusTitle: string) {
  return testMyOrderRow({
    id: statusTitle,
    kind: "informacja",
    statusTitle,
    lines: [],
    supplierName: "X",
    product: "P",
    symbol: null,
    quantityLabel: "—",
    submittedLabel: "01.01",
    requestKind: "informacja",
  });
}

describe("my-order-informacja-sections", () => {
  it("rozdziela etapy informacji", () => {
    const sections = partitionInformacjaProgressRows([
      row("Oczekuje na magazyn"),
      row("Zamówione — czekamy na magazyn"),
      row("Czekamy na zamówienie u dostawcy"),
    ]);
    expect(sections.map((s) => s.phase)).toEqual([
      "awaiting_procurement",
      "ordered_awaiting_warehouse",
      "direct_monitoring",
    ]);
    expect(sections[1]!.rows).toHaveLength(1);
  });

  it("mapuje statusTitle na fazę", () => {
    expect(informacjaProgressPhase(row("Oczekuje na magazyn"))).toBe(
      "direct_monitoring"
    );
  });
});
