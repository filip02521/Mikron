import { describe, it, expect } from "vitest";
import {
  applyVacationLogic,
  effectiveShiftDate,
  filterApplicableVacationPeriods,
  isDateInVacationWindow,
  resolveVacationConflictOnOrder,
  resolveVacationConflictOnShift,
  vacationRangesOverlap,
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

  it("przyspiesza ZAGRANICA gdy ostatnie zamówienie > tydzień po order_date", () => {
    const result = applyVacationLogic({
      orderDate: new Date("2025-06-01T12:00:00"),
      shiftDate: null,
      interval: { unit: "weeks", value: 8 },
      location: "ZAGRANICA",
      vacations: [vacation],
    });
    expect(result.vacationNote).toBe("PRZYSPIESZONE_PRZED");
    expect(formatDateString(result.nextDate!)).toBe("2025-07-25");
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

describe("vacation policy helpers", () => {
  const vacation = {
    start: new Date("2025-08-01"),
    end: new Date("2025-08-15"),
    lastOrder: new Date("2025-07-25"),
  };

  it("isDateInVacationWindow obejmuje okno przed startem urlopu", () => {
    expect(isDateInVacationWindow(new Date("2025-07-28"), vacation)).toBe(true);
    expect(isDateInVacationWindow(new Date("2025-07-20"), vacation)).toBe(false);
  });

  it("vacationRangesOverlap wykrywa nakładanie", () => {
    const a = { start: new Date("2025-08-01"), end: new Date("2025-08-15") };
    const b = { start: new Date("2025-08-10"), end: new Date("2025-08-20") };
    expect(vacationRangesOverlap(a, b)).toBe(true);
    expect(
      vacationRangesOverlap(
        { start: new Date("2025-09-01"), end: new Date("2025-09-10") },
        b
      )
    ).toBe(false);
  });

  it("filterApplicableVacationPeriods pomija minione urlopy", () => {
    const today = new Date("2025-09-01");
    const filtered = filterApplicableVacationPeriods([vacation], today);
    expect(filtered).toHaveLength(0);
  });

  it("effectiveShiftDate ignoruje zaległe przesunięcia", () => {
    const today = new Date("2025-09-01");
    expect(effectiveShiftDate(new Date("2025-08-10"), today)).toBeNull();
    expect(effectiveShiftDate(new Date("2025-09-05"), today)).not.toBeNull();
  });
});

describe("resolveVacationConflictOnOrder", () => {
  const vacation = {
    start: new Date("2025-08-01"),
    end: new Date("2025-08-15"),
    lastOrder: new Date("2025-07-25"),
  };

  it("moves order date out of vacation block", () => {
    const adjusted = resolveVacationConflictOnOrder(new Date("2025-08-10"), [vacation]);
    expect(formatDateString(adjusted)).toBe("2025-08-18");
  });

  it("przesuwa termin z okna przed urlopem tak jak applyVacationLogic", () => {
    const adjusted = resolveVacationConflictOnOrder(new Date("2025-07-28"), [vacation]);
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
