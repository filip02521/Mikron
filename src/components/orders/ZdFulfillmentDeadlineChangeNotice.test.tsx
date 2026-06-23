import { describe, expect, it } from "vitest";
import { buildZdFulfillmentDeadlineChangeDisplay } from "@/lib/orders/zd-fulfillment-deadline-change";
import { zdFulfillmentDeadlineChangeShortLabel } from "@/lib/orders/zd-fulfillment-deadline-change";
import {
  buildZdDeadlineChangeToastMessage,
  zdDeadlineChangeToastTone,
} from "@/components/moje/zd-fulfillment-deadline-change-auto-ack-copy";
import { collectPendingZdDeadlineChanges } from "@/components/moje/ZdFulfillmentDeadlineChangeAutoAck";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";

function rowWithDeadlineChange(
  orderIds: string[],
  supplierName: string,
  changedAt: string
): MyOrderRow {
  const change = buildZdFulfillmentDeadlineChangeDisplay(
    "2026-06-18",
    "2026-06-26",
    changedAt,
    { firstConfirmation: true }
  );
  return {
    id: "row-1",
    orderIds,
    supplierName,
    lines: [],
    zdFulfillment: { deadline: "2026-06-26", dokNr: "ZD 1", deadlineChange: change },
  } as MyOrderRow;
}

describe("zdFulfillmentDeadlineChangeShortLabel", () => {
  it("skraca zmianę terminu do jednej linii z datami", () => {
    const change = buildZdFulfillmentDeadlineChangeDisplay(
      "2026-07-15",
      "2026-07-22",
      "2026-06-18T08:00:00Z"
    );
    expect(zdFulfillmentDeadlineChangeShortLabel(change)).toBe(
      "Termin przesunięty · 15.07.2026 → 22.07.2026"
    );
  });

  it("skraca pierwsze ustalenie terminu bez daty poprzedniej", () => {
    const change = buildZdFulfillmentDeadlineChangeDisplay(
      "2026-06-18",
      "2026-07-22",
      "2026-06-19T08:00:00Z",
      { firstConfirmation: true }
    );
    expect(zdFulfillmentDeadlineChangeShortLabel(change)).toBe(
      "Ustalono termin realizacji · 22.07.2026"
    );
  });
});

describe("ZdFulfillmentDeadlineChangeAutoAck toast copy", () => {
  it("łączy nazwę dostawcy ze skrótem zmiany terminu", () => {
    const change = buildZdFulfillmentDeadlineChangeDisplay(
      "2026-06-18",
      "2026-06-26",
      "2026-06-18T08:00:00Z",
      { firstConfirmation: true }
    );
    expect(
      buildZdDeadlineChangeToastMessage([
        { orderIds: ["o1"], supplierName: "DT Shop", change },
      ])
    ).toBe("DT Shop · Ustalono termin realizacji · 26.06.2026");
  });

  it("używa ostrzeżenia przy przesunięciu terminu", () => {
    const change = buildZdFulfillmentDeadlineChangeDisplay(
      "2026-06-18",
      "2026-06-26",
      "2026-06-18T08:00:00Z"
    );
    expect(
      zdDeadlineChangeToastTone([
        { orderIds: ["o1"], supplierName: "DT Shop", change },
      ])
    ).toBe("warning");
  });

  it("zbiera osobne zmiany terminu dla tego samego zamówienia", () => {
    const first = collectPendingZdDeadlineChanges([
      rowWithDeadlineChange(["o1"], "DT Shop", "2026-06-18T08:00:00Z"),
    ]);
    const second = collectPendingZdDeadlineChanges([
      rowWithDeadlineChange(["o1"], "DT Shop", "2026-06-19T08:00:00Z"),
    ]);
    expect(first[0]?.change.changedAt).not.toBe(second[0]?.change.changedAt);
  });

  it("zbiera zmianę terminu z linii gdy wiersz nie ma zdFulfillment", () => {
    const change = buildZdFulfillmentDeadlineChangeDisplay(
      "2026-06-18",
      "2026-06-26",
      "2026-06-18T08:00:00Z",
      { firstConfirmation: true }
    );
    const pending = collectPendingZdDeadlineChanges([
      {
        id: "row-pickup",
        orderIds: ["o1", "o2"],
        supplierName: "DT Shop",
        lines: [
          {
            id: "o1",
            zdFulfillment: { deadline: "2026-06-26", dokNr: "ZD 1", deadlineChange: change },
          },
        ],
        zdFulfillment: null,
      } as MyOrderRow,
    ]);
    expect(pending).toEqual([
      { orderIds: ["o1"], supplierName: "DT Shop", change },
    ]);
  });
});
