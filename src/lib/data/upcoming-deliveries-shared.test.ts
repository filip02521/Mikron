import { describe, expect, it } from "vitest";
import {
  buildDeliveryScheduleWeek,
  buildDeliveryTodayDay,
  clearedSupplierIdsByDateFromPayload,
  deliveryDayForScheduleDate,
  hideScheduledReceivedToday,
  journalHasReceiptForDeadline,
  mergeUpcomingDeliverySuppliers,
  type DeliveryScheduleDay,
  type UpcomingDeliveryDay,
  type UpcomingDeliverySupplier,
} from "@/lib/data/upcoming-deliveries-shared";
import { testSupplierWithSchedule } from "@/test-utils/fixtures";
import type { SupplierWithSchedule } from "@/types/database";

function supplier(
  partial: Partial<UpcomingDeliverySupplier> & Pick<UpcomingDeliverySupplier, "supplierId" | "supplierName">
): UpcomingDeliverySupplier {
  return {
    zdDocNumber: null,
    positionCount: 1,
    totalQuantity: 10,
    totalDelivered: 0,
    salesPeople: [],
    carrierHint: null,
    carrierLabel: null,
    orders: [],
    zdOnlyDocNumbers: [],
    ...partial,
  };
}

function day(
  dateKey: string,
  suppliers: UpcomingDeliverySupplier[],
  extras?: Partial<UpcomingDeliveryDay>
): UpcomingDeliveryDay {
  return {
    dateKey,
    dateLabel: dateKey.slice(5).replace("-", "."),
    weekdayLabel: "Pon",
    isToday: false,
    isOverdue: false,
    suppliers,
    ...extras,
  };
}

describe("journalHasReceiptForDeadline", () => {
  it("matches receipt on deadline day", () => {
    const index = new Map([["s1", new Set(["2026-08-08"])]]);
    expect(journalHasReceiptForDeadline(index, "2026-08-08", "s1", "2026-08-09")).toBe(true);
  });

  it("matches receipt after overdue deadline (received today)", () => {
    const index = new Map([["s1", new Set(["2026-08-09"])]]);
    expect(journalHasReceiptForDeadline(index, "2026-08-07", "s1", "2026-08-09")).toBe(true);
  });

  it("ignores receipt before deadline", () => {
    const index = new Map([["s1", new Set(["2026-08-01"])]]);
    expect(journalHasReceiptForDeadline(index, "2026-08-07", "s1", "2026-08-09")).toBe(false);
  });
});

describe("deliveryDayForScheduleDate", () => {
  it("rolls overdue ZD suppliers into today", () => {
    const map = new Map<string, UpcomingDeliveryDay>([
      ["2026-08-07", day("2026-08-07", [supplier({ supplierId: "a", supplierName: "Alpha" })], { isOverdue: true })],
      ["2026-08-09", day("2026-08-09", [supplier({ supplierId: "b", supplierName: "Beta" })], { isToday: true })],
    ]);
    const merged = deliveryDayForScheduleDate(
      "2026-08-09",
      "2026-08-09",
      map,
      "09.08",
      "Sob"
    );
    expect(merged?.suppliers.map((s) => s.supplierId).sort()).toEqual(["a", "b"]);
    expect(merged?.suppliers.find((s) => s.supplierId === "a")?.isOverdueDeadline).toBe(true);
    expect(merged?.suppliers.find((s) => s.supplierId === "b")?.isOverdueDeadline).toBe(false);
    expect(merged?.isOverdue).toBe(true);
  });

  it("does not roll overdue into mid-week non-today columns", () => {
    const map = new Map<string, UpcomingDeliveryDay>([
      ["2026-08-07", day("2026-08-07", [supplier({ supplierId: "a", supplierName: "Alpha" })])],
    ]);
    expect(
      deliveryDayForScheduleDate("2026-08-08", "2026-08-09", map, "08.08", "Pt")
    ).toBeNull();
  });
});

describe("mergeUpcomingDeliverySuppliers", () => {
  it("merges quantities and marks overdue", () => {
    const a = supplier({
      supplierId: "s",
      supplierName: "S",
      totalQuantity: 5,
      totalDelivered: 1,
    });
    const b = supplier({
      supplierId: "s",
      supplierName: "S",
      totalQuantity: 3,
      totalDelivered: 0,
      isOverdueDeadline: true,
    });
    const m = mergeUpcomingDeliverySuppliers(a, b);
    expect(m.totalQuantity).toBe(8);
    expect(m.totalDelivered).toBe(1);
    expect(m.isOverdueDeadline).toBe(true);
  });
});

describe("buildDeliveryScheduleWeek + hideScheduledReceivedToday", () => {
  const schedules: SupplierWithSchedule[] = [
    testSupplierWithSchedule({
      id: "plan-only",
      name: "Plan Only",
      schedule: {
        id: "sch1",
        supplier_id: "plan-only",
        order_date: "2026-08-07",
        shift_date: null,
        computed_next_date: "2026-08-07",
        vacation_note: null,
      },
    }),
    testSupplierWithSchedule({
      id: "zd-and-plan",
      name: "ZD And Plan",
      schedule: {
        id: "sch2",
        supplier_id: "zd-and-plan",
        order_date: "2026-08-07",
        shift_date: null,
        computed_next_date: "2026-08-07",
        vacation_note: null,
      },
    }),
  ];

  it("dedupes plan card when ZD card exists and rolls overdue ZD into Friday today", () => {
    const today = "2026-08-07";
    const deliveryDays = [
      day("2026-08-05", [supplier({ supplierId: "overdue-zd", supplierName: "Overdue ZD" })]),
      day("2026-08-07", [
        supplier({ supplierId: "zd-and-plan", supplierName: "ZD And Plan" }),
      ]),
    ];
    const week = buildDeliveryScheduleWeek(schedules, deliveryDays, today, "2026-08-03");
    const friday = week.find((d) => d.dateKey === today);
    expect(friday?.isToday).toBe(true);
    const zdIds = friday?.deliveryDay?.suppliers.map((s) => s.supplierId) ?? [];
    expect(zdIds).toContain("overdue-zd");
    expect(zdIds).toContain("zd-and-plan");
    expect(friday?.scheduledSuppliers.map((s) => s.supplierId)).toEqual(["plan-only"]);
    expect(friday?.scheduledSuppliers[0]?.planDateKey).toBe("2026-08-07");
  });

  it("hides plan card after journal receipt today", () => {
    const base: DeliveryScheduleDay = {
      dateKey: "2026-08-07",
      weekdayLabel: "Pt",
      dateLabel: "07.08",
      isToday: true,
      isPast: false,
      scheduledSuppliers: [
        {
          supplierId: "plan-only",
          supplierName: "Plan Only",
          location: "POLSKA",
          isScheduled: true,
          isOverduePlan: false,
          planDateKey: "2026-08-07",
          vacationNote: null,
        },
      ],
      deliveryDay: null,
    };
    const hidden = hideScheduledReceivedToday([base], ["plan-only"]);
    expect(hidden[0]?.scheduledSuppliers).toEqual([]);
  });

  it("hides plan card only for cleared deadline matching planDateKey (no history poison)", () => {
    const base: DeliveryScheduleDay = {
      dateKey: "2026-08-07",
      weekdayLabel: "Pt",
      dateLabel: "07.08",
      isToday: true,
      isPast: false,
      scheduledSuppliers: [
        {
          supplierId: "weekly",
          supplierName: "Weekly",
          location: "POLSKA",
          isScheduled: true,
          isOverduePlan: false,
          planDateKey: "2026-08-07",
          vacationNote: null,
        },
      ],
      deliveryDay: null,
    };
    // Cleared last week must NOT hide this week's plan.
    const clearedOld = clearedSupplierIdsByDateFromPayload({
      "2026-07-31": ["weekly"],
    });
    expect(hideScheduledReceivedToday([base], [], clearedOld)[0]?.scheduledSuppliers).toHaveLength(1);

    const clearedToday = clearedSupplierIdsByDateFromPayload({
      "2026-08-07": ["weekly"],
    });
    expect(hideScheduledReceivedToday([base], [], clearedToday)[0]?.scheduledSuppliers).toEqual([]);
  });

  it("hides overdue plan when ZD for that planDateKey was cleared", () => {
    const base: DeliveryScheduleDay = {
      dateKey: "2026-08-07",
      weekdayLabel: "Pt",
      dateLabel: "07.08",
      isToday: true,
      isPast: false,
      scheduledSuppliers: [
        {
          supplierId: "late",
          supplierName: "Late",
          location: "POLSKA",
          isScheduled: true,
          isOverduePlan: true,
          planDateKey: "2026-08-05",
          vacationNote: null,
        },
      ],
      deliveryDay: null,
    };
    const cleared = clearedSupplierIdsByDateFromPayload({ "2026-08-05": ["late"] });
    expect(hideScheduledReceivedToday([base], [], cleared)[0]?.scheduledSuppliers).toEqual([]);
  });
});

describe("buildDeliveryTodayDay (weekend)", () => {
  it("builds today snapshot with overdue ZD when today is Saturday", () => {
    const saturday = "2026-08-08";
    const snapshot = buildDeliveryTodayDay(
      [
        testSupplierWithSchedule({
          id: "plan",
          name: "Plan",
          schedule: {
            id: "s",
            supplier_id: "plan",
            order_date: "2026-08-07",
            shift_date: null,
            computed_next_date: "2026-08-07",
            vacation_note: null,
          },
        }),
      ],
      [day("2026-08-05", [supplier({ supplierId: "zd", supplierName: "ZD" })])],
      saturday
    );
    expect(snapshot?.isToday).toBe(true);
    expect(snapshot?.deliveryDay?.suppliers.map((s) => s.supplierId)).toEqual(["zd"]);
    expect(snapshot?.scheduledSuppliers.map((s) => s.supplierId)).toEqual(["plan"]);
    expect(snapshot?.scheduledSuppliers[0]?.isOverduePlan).toBe(true);
  });
});
