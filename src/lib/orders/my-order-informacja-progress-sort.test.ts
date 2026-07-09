import { describe, expect, it } from "vitest";
import type { MyOrderRow } from "./my-order-presenter";
import { sortInformacjaProgressRows } from "./my-order-informacja-progress-sort";

function row(extra: Partial<MyOrderRow> = {}): MyOrderRow {
  return {
    id: extra.id ?? "r1",
    kind: "informacja",
    supplierName: "Test",
    product: "Prod",
    statusTitle: "Dostępne",
    acknowledgeMode: "none",
    pickupPendingCount: 0,
    pickupPendingIds: [],
    pickupTeethPendingIds: [],
    pickupShelfPendingIds: [],
    orderIds: extra.orderIds ?? ["o1"],
    submittedLabel: extra.submittedLabel ?? "01.06.2026",
    ...extra,
  } as MyOrderRow;
}

describe("sortInformacjaProgressRows", () => {
  it("wstawia prośby do potwierdzenia na górę listy", () => {
    const ack = row({
      id: "ack",
      acknowledgeMode: "availability",
      pickupPendingCount: 1,
      timingLabel: "E-mail 19.06.2026",
      submittedLabel: "10.06.2026",
    });
    const waiting = row({
      id: "wait",
      statusTitle: "Oczekuje na magazyn",
      submittedLabel: "15.06.2026",
    });

    const sorted = sortInformacjaProgressRows([waiting, ack]);
    expect(sorted.map((r) => r.id)).toEqual(["ack", "wait"]);
  });

  it("sortuje potwierdzenia po dacie e-maila — najświeższy u góry", () => {
    const older = row({
      id: "old",
      acknowledgeMode: "availability",
      pickupPendingCount: 1,
      timingLabel: "E-mail 17.06.2026",
    });
    const newer = row({
      id: "new",
      acknowledgeMode: "availability",
      pickupPendingCount: 1,
      timingLabel: "E-mail 19.06.2026",
    });

    const sorted = sortInformacjaProgressRows([older, newer]);
    expect(sorted.map((r) => r.id)).toEqual(["new", "old"]);
  });
});
