import type { SalesPersonAdminRow } from "@/lib/data/sales-people-admin";
import type { MyOrderLine, MyOrderRow } from "@/lib/orders/my-order-presenter";
import type { ForSomeoneLine } from "@/lib/orders/summary-workspace";
import type {
  IndividualOrder,
  SalesNote,
  Supplier,
  SupplierWithSchedule,
} from "@/types/database";

export function testIndividualOrder(
  partial: Partial<IndividualOrder> & Pick<IndividualOrder, "id">
): IndividualOrder {
  return {
    supplier_id: "s1",
    sales_person_id: "sp1",
    symbol: "-",
    products: "Produkt",
    quantity: "1",
    delivered_quantity: "-",
    order_type: "None",
    request_kind: "zamowienie",
    status: "Nowe",
    action_at: "2026-01-01T10:00:00Z",
    ordered_at: null,
    delivery_at: null,
    ...partial,
  };
}

export function testSupplier(
  partial: Partial<Supplier> & Pick<Supplier, "id" | "name">
): Supplier {
  return {
    location: "POLSKA",
    pickup_mikran: false,
    pickup_pallet: false,
    notes: "",
    mails: "",
    extra_info: "",
    interval_raw: null,
    interval_weeks: null,
    stock_raw: null,
    stock: null,
    stats_mode: "LACZNIE",
    order_on_demand: false,
    is_active: true,
    ...partial,
  };
}

export function testSupplierWithSchedule(
  partial: Partial<SupplierWithSchedule> & Pick<SupplierWithSchedule, "id" | "name">
): SupplierWithSchedule {
  const { schedule, ...rest } = partial;
  return {
    ...testSupplier(rest),
    schedule: schedule ?? null,
    ...partial,
  };
}

export function testMyOrderLine(
  partial: Partial<MyOrderLine> & Pick<MyOrderLine, "id">
): MyOrderLine {
  return {
    product: "Produkt",
    symbol: "SYM",
    subiektTwId: null,
    mikranCode: null,
    quantity: "1",
    quantityLabel: "1 szt.",
    progressLabel: null,
    stockStatus: "waiting",
    canAcknowledgePickup: false,
    clientName: null,
    clientKhId: null,
    ...partial,
  };
}

export function testMyOrderRow(
  partial: Partial<MyOrderRow> & Pick<MyOrderRow, "id">
): MyOrderRow {
  return {
    kind: "zamowienie",
    lineCount: 1,
    lines: [testMyOrderLine({ id: "l1" })],
    submittedLabel: "01.01",
    supplierName: "Dostawca",
    product: "Produkt",
    symbol: "SYM",
    quantityLabel: "1 szt.",
    progressLabel: null,
    statusTitle: "Status",
    statusDetail: null,
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
    supplierId: "s1",
    salesPersonId: "sp1",
    requestKind: "zamowienie",
    canEditBySales: false,
    ...partial,
  };
}

export function testForSomeoneLine(
  partial: Partial<ForSomeoneLine> & Pick<ForSomeoneLine, "id">
): ForSomeoneLine {
  return {
    products: "X",
    symbol: "-",
    quantity: "1",
    fromSubiekt: false,
    ...partial,
  };
}

export function testSalesPersonAdminRow(
  partial: Partial<SalesPersonAdminRow> & Pick<SalesPersonAdminRow, "id" | "name">
): SalesPersonAdminRow {
  return {
    email: "a@b.pl",
    groupId: null,
    groupName: null,
    orderCount: 0,
    pendingZkCount: 0,
    followUpDueZkCount: 0,
    linkedUserId: null,
    linkedUserEmail: null,
    linkedUserLastSignInAt: null,
    ...partial,
  };
}

export function testSalesNote(partial: Partial<SalesNote> & Pick<SalesNote, "id">): SalesNote {
  return {
    sales_person_id: "sp1",
    title: null,
    body: "",
    color: "default",
    pinned: false,
    sort_order: 0,
    archived_at: null,
    follow_up_at: null,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}
