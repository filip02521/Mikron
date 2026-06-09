import { describe, expect, it } from "vitest";
import {
  progressLabelInSubline,
  rowNeedsSalesAcknowledgement,
  shouldShowMyOrderHeadlineBanner,
  shouldShowOrderStatusBadge,
  shouldShowOrderStatusDetail,
} from "./my-order-card-ui";
import type { MyOrderRow } from "./my-order-presenter";

function row(extra: Partial<MyOrderRow> = {}): MyOrderRow {
  return {
    id: "1",
    kind: "zamowienie",
    lineCount: 1,
    lines: [],
    submittedLabel: "01.05",
    supplierName: "Dostawca",
    product: "P",
    symbol: null,
    quantityLabel: "2 szt.",
    progressLabel: null,
    statusTitle: "Zamówione",
    statusDetail: "Szczegóły",
    timingLabel: null,
    badgeVariant: "info",
    rowColor: "#fff",
    orderIds: ["1"],
    acknowledgeMode: "none",
    pickupPendingCount: 0,
    pickupPendingIds: [],
    pickupReadyTotal: 0,
    pickupAcknowledgedCount: 0,
    canCancelBySales: false,
    salesCancelPhase: null,
    salesCancelOrderIds: [],
    cancelNoticeOrderIds: [],
    cancelledAckOrderIds: [],
    clientLabel: null,
    supplierId: "s",
    salesPersonId: "sp",
    requestKind: "zamowienie",
    canEditBySales: false,
    headline: "Test",
    headlineTone: "info",
    subline: null,
    ...extra,
  };
}

describe("my-order-card-ui", () => {
  it("ukrywa badge przy odbiorze", () => {
    expect(
      shouldShowOrderStatusBadge(
        row({ acknowledgeMode: "pickup", headlineTone: "action" })
      )
    ).toBe(false);
    expect(shouldShowOrderStatusBadge(row())).toBe(false);
    expect(
      shouldShowOrderStatusBadge(
        row({ headlineTone: "warning", headline: "Po przewidywanym terminie" })
      )
    ).toBe(false);
  });

  it("pasek tylko przy potwierdzeniu, nie przy statusie w toku", () => {
    expect(
      shouldShowMyOrderHeadlineBanner(
        row({ acknowledgeMode: "pickup", headlineTone: "action" }),
        { expanded: false, compactActionLayout: false, canAcknowledge: true }
      )
    ).toBe(true);
    expect(
      shouldShowMyOrderHeadlineBanner(
        row({ headlineTone: "warning", headline: "Po przewidywanym terminie" }),
        { expanded: false, compactActionLayout: false, canAcknowledge: true }
      )
    ).toBe(false);
    expect(
      shouldShowMyOrderHeadlineBanner(
        row({ acknowledgeMode: "pickup", headlineTone: "action" }),
        { expanded: false, compactActionLayout: true, canAcknowledge: true }
      )
    ).toBe(false);
  });

  it("rowNeedsSalesAcknowledgement rozpoznaje anulowanie", () => {
    expect(rowNeedsSalesAcknowledgement(row({ acknowledgeMode: "pickup" }))).toBe(
      true
    );
    expect(
      rowNeedsSalesAcknowledgement(
        row({ acknowledgeMode: "cancelled", cancelledAckOrderIds: ["x"] })
      )
    ).toBe(true);
    expect(rowNeedsSalesAcknowledgement(row({ headlineTone: "warning" }))).toBe(
      false
    );
  });

  it("ukrywa statusDetail gdy zbędny", () => {
    expect(
      shouldShowOrderStatusDetail(
        row({ acknowledgeMode: "pickup", statusDetail: "Potwierdź" })
      )
    ).toBe(false);
    expect(
      shouldShowOrderStatusDetail(
        row({
          statusTitle: "Uzupełnianie danych",
          statusDetail: "Brakuje: dostawca. Dział dostaw uzupełni to w systemie.",
        })
      )
    ).toBe(false);
  });

  it("wykrywa postęp w subline", () => {
    expect(progressLabelInSubline(row({ subline: "Magazyn: 1 z 2 szt." }))).toBe(
      true
    );
  });
});
