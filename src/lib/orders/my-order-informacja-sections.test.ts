import { describe, expect, it } from "vitest";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import {
  informacjaProgressPhase,
  partitionInformacjaProgressRows,
} from "./my-order-informacja-sections";

function row(statusTitle: string): MyOrderRow {
  return {
    id: statusTitle,
    kind: "informacja",
    statusTitle,
    lineCount: 1,
    lines: [],
    supplierName: "X",
    product: "P",
    symbol: null,
    quantityLabel: "—",
    progressLabel: null,
    rowColor: "#fff",
    submittedLabel: "01.01",
    headline: statusTitle,
    headlineTone: "neutral",
    statusDetail: null,
    timingLabel: null,
    badgeVariant: "info",
    acknowledgeMode: "none",
    pickupPendingCount: 0,
    pickupPendingIds: [],
    pickupReadyTotal: 0,
    pickupAcknowledgedCount: 0,
    orderIds: ["1"],
    requestKind: "informacja",
    canEditBySales: false,
  } as MyOrderRow;
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
