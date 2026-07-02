import { describe, expect, it } from "vitest";
import {
  myOrderUsesSalesHeadline,
  progressLabelInSubline,
  rowNeedsSalesAcknowledgement,
  shouldShowCollapsedProductSummary,
  shouldShowExpandedOrderStatusBadge,
  shouldShowMyOrderHeadlineBanner,
  shouldShowOrderStatusBadge,
  shouldShowOrderStatusDetail,
  filterRedundantExpandedMetaFields,
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
  it("rozpoznaje nagłówek sales UI", () => {
    expect(
      myOrderUsesSalesHeadline(
        row({ headline: "Czeka na zamówienie u dostawcy", statusTitle: "Przed zamówieniem" })
      )
    ).toBe(true);
    expect(myOrderUsesSalesHeadline(row({ headline: "Zamówione", statusTitle: "Zamówione" }))).toBe(
      false
    );
  });

  it("ukrywa badge przy nagłówku sales UI (neutral)", () => {
    expect(
      shouldShowOrderStatusBadge(
        row({
          headlineTone: "neutral",
          headline: "Powiadomimy, gdy towar przyjedzie",
          statusTitle: "Oczekuje na magazyn",
        })
      )
    ).toBe(false);
    expect(
      shouldShowOrderStatusBadge(
        row({
          headlineTone: "neutral",
          headline: "Czeka na zamówienie u dostawcy",
          statusTitle: "Przed zamówieniem",
        })
      )
    ).toBe(false);
  });

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
    expect(
      shouldShowOrderStatusBadge(
        row({ headlineTone: "dismiss", headline: "Potwierdź informację o rezygnacji" })
      )
    ).toBe(false);
  });

  it("pasek tylko przy potwierdzeniu, nie przy statusie w toku", () => {
    expect(
      shouldShowMyOrderHeadlineBanner(
        row({
          acknowledgeMode: "pickup",
          headlineTone: "action",
          pickupPendingCount: 1,
        }),
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
        row({
          acknowledgeMode: "pickup",
          headlineTone: "action",
          pickupPendingCount: 1,
        }),
        { expanded: false, compactActionLayout: true, canAcknowledge: true }
      )
    ).toBe(false);
  });

  it("rowNeedsSalesAcknowledgement rozpoznaje anulowanie", () => {
    expect(
      rowNeedsSalesAcknowledgement(
        row({ acknowledgeMode: "pickup", pickupPendingCount: 1 })
      )
    ).toBe(true);
    expect(
      rowNeedsSalesAcknowledgement(
        row({ acknowledgeMode: "pickup", pickupPendingCount: 0 })
      )
    ).toBe(false);
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

  it("ukrywa badge przy informacyjnych — wystarczy badge Informacyjna i nagłówek", () => {
    expect(
      shouldShowOrderStatusBadge(
        row({
          kind: "informacja",
          requestKind: "informacja",
          statusTitle: "Informacja o dostępności",
          headline: "Powiadomimy, gdy towar przyjedzie",
          headlineTone: "neutral",
          badgeVariant: "purple",
        })
      )
    ).toBe(false);
  });

  it("ukrywa badge w rozwinięciu gdy jest pasek postępu", () => {
    expect(
      shouldShowExpandedOrderStatusBadge(row(), { hasRequestProgress: true })
    ).toBe(false);
  });

  it("ukrywa badge w rozwinięciu gdy jest blok terminu dostawy", () => {
    expect(
      shouldShowExpandedOrderStatusBadge(row(), {
        hasRequestProgress: false,
        hasExpandedDeliveryTiming: true,
      })
    ).toBe(false);
  });

  it("filtruje zduplikowane metadane magazynu", () => {
    const fields = filterRedundantExpandedMetaFields(
      row({
        statusTitle: "Częściowo na magazynie",
        subline: "Magazyn: 1 z 2 szt.",
        progressLabel: "1 z 2 szt. na magazynie",
      }),
      [
        { label: "Zgłoszono", value: "01.05" },
        { label: "Magazyn", value: "1 z 2 szt." },
      ]
    );
    expect(fields.some((f) => f.label === "Magazyn")).toBe(false);
  });

  it("wykrywa postęp w subline", () => {
    expect(progressLabelInSubline(row({ subline: "Magazyn: 1 z 2 szt." }))).toBe(
      true
    );
  });

  it("ukrywa productSummary na desktopie gdy nagłówek i subline już niosą status", () => {
    expect(
      shouldShowCollapsedProductSummary(
        row({ lineCount: 3, subline: "Magazyn: 1 z 3 szt." }),
        {
          expanded: false,
          showRowHeadline: true,
          suppressSharedHeadline: false,
          hasCollapsedSubline: true,
        }
      )
    ).toBe(false);
    expect(
      shouldShowCollapsedProductSummary(
        row({ lineCount: 3, subline: null }),
        {
          expanded: false,
          showRowHeadline: true,
          suppressSharedHeadline: false,
          hasCollapsedSubline: false,
        }
      )
    ).toBe(true);
  });
});
