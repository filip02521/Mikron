import { describe, it, expect } from "vitest";
import {
  applyVacationLogic,
  resolveVacationConflictOnOrder,
  resolveVacationConflictOnShift,
} from "./vacations";
import { formatDateString } from "./dates";

describe("applyVacationLogic", () => {
  const vacation = {
    start: new Date("2025-08-01"),
    end: new Date("2025-08-15"),
    lastOrder: new Date("2025-07-25"),
  };

  it("shifts POLSKA date after vacation", () => {
    const result = applyVacationLogic({
      orderDate: new Date("2025-07-01"),
      shiftDate: null,
      interval: { unit: "weeks", value: 4 },
      location: "POLSKA",
      vacations: [vacation],
    });
    expect(result.vacationNote).toBe("PRZESUNIETE_PO");
    expect(result.nextDate).not.toBeNull();
    expect(formatDateString(result.nextDate!)).toBe("2025-08-18");
  });

  it("handles ZAGRANICA vacation rules", () => {
    const result = applyVacationLogic({
      orderDate: new Date("2025-06-01T12:00:00"),
      shiftDate: null,
      interval: { unit: "weeks", value: 8 },
      location: "ZAGRANICA",
      vacations: [vacation],
    });
    expect(result.nextDate).not.toBeNull();
    expect(["PRZYSPIESZONE_PRZED", "PRZESUNIETE_PO", null]).toContain(
      result.vacationNote
    );
  });

  it("sets OSTATNIE_ZAMOWIENIE when term falls before vacation but next interval would pass last order", () => {
    const result = applyVacationLogic({
      orderDate: new Date("2025-07-18"),
      shiftDate: new Date("2025-07-24"),
      interval: { unit: "weeks", value: 1 },
      location: "POLSKA",
      vacations: [vacation],
    });
    expect(result.vacationNote).toBe("OSTATNIE_ZAMOWIENIE");
    expect(formatDateString(result.nextDate!)).toBe("2025-07-24");
  });

  it("używa wcześniejszego urlopu gdy lista nie jest posortowana", () => {
    const later = {
      start: new Date("2025-09-01"),
      end: new Date("2025-09-15"),
      lastOrder: new Date("2025-08-25"),
    };
    const earlier = {
      start: new Date("2025-08-01"),
      end: new Date("2025-08-15"),
      lastOrder: new Date("2025-07-25"),
    };
    const result = applyVacationLogic({
      orderDate: new Date("2025-07-01"),
      shiftDate: null,
      interval: { unit: "weeks", value: 4 },
      location: "POLSKA",
      vacations: [later, earlier],
    });
    expect(result.vacationNote).toBe("PRZESUNIETE_PO");
    expect(formatDateString(result.nextDate!)).toBe("2025-08-18");
  });

  it("ignores inactive-style gaps (invalid dates skipped in caller)", () => {
    const result = applyVacationLogic({
      orderDate: new Date("2025-09-01"),
      shiftDate: null,
      interval: { unit: "weeks", value: 2 },
      location: "POLSKA",
      vacations: [],
    });
    expect(result.vacationNote).toBeNull();
    expect(formatDateString(result.nextDate!)).toBe("2025-09-15");
  });
});

describe("resolveVacationConflictOnOrder", () => {
  it("moves order date out of vacation block", () => {
    const adjusted = resolveVacationConflictOnOrder(new Date("2025-08-10"), [
      {
        start: new Date("2025-08-01"),
        end: new Date("2025-08-15"),
        lastOrder: new Date("2025-07-25"),
      },
    ]);
    expect(formatDateString(adjusted)).toBe("2025-08-18");
  });
});

describe("resolveVacationConflictOnShift", () => {
  it("ZAGRANICA shift inside vacation snaps to last order date", () => {
    const adjusted = resolveVacationConflictOnShift(
      new Date("2025-08-10"),
      "ZAGRANICA",
      [
        {
          start: new Date("2025-08-01"),
          end: new Date("2025-08-15"),
          lastOrder: new Date("2025-07-28"),
        },
      ],
      null
    );
    expect(formatDateString(adjusted)).toBe("2025-07-28");
  });
});
