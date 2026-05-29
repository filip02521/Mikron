import { describe, expect, it } from "vitest";
import { formatDateString } from "@/lib/orders/dates";
import {
  classifyHistoriaAction,
  replayHistoriaScheduleState,
} from "@/lib/orders/historia-schedule-actions";

describe("classifyHistoriaAction", () => {
  it("traktuje Zamówione i Zamówienie Główne jako zamówienie", () => {
    expect(classifyHistoriaAction("Zamówione")).toBe("ordered");
    expect(classifyHistoriaAction("Zamówienie Główne (dla: Kasia K.)")).toBe("ordered");
  });

  it("rozpoznaje przesunięcia", () => {
    expect(classifyHistoriaAction("Przesunięte o 3 tyg.")).toBe("shift");
    expect(classifyHistoriaAction("Ręcznie przesunięte")).toBe("shift");
  });
});

describe("replayHistoriaScheduleState", () => {
  it("ostatnie zamówienie ustawia order_date i czyści shift", () => {
    const state = replayHistoriaScheduleState([
      {
        actionAt: new Date("2026-04-23T10:00:00"),
        action: "Zamówione",
        nextDate: new Date("2026-05-20"),
      },
      {
        actionAt: new Date("2026-05-20T09:52:00"),
        action: "Zamówienie Główne (dla: Kasia K.)",
        nextDate: new Date("2026-06-17"),
      },
    ]);
    expect(formatDateString(state.orderDate!)).toBe("2026-05-20");
    expect(state.shiftDate).toBeNull();
    expect(formatDateString(state.sheetNextDate!)).toBe("2026-06-17");
  });

  it("przesunięcie po zamówieniu ustawia shift_date z kolumny następnej daty", () => {
    const state = replayHistoriaScheduleState([
      {
        actionAt: new Date("2026-05-01T10:00:00"),
        action: "Zamówione",
        nextDate: new Date("2026-05-29"),
      },
      {
        actionAt: new Date("2026-05-10T10:00:00"),
        action: "Przesunięte o 3 tyg.",
        nextDate: new Date("2026-06-17"),
      },
    ]);
    expect(formatDateString(state.shiftDate!)).toBe("2026-06-17");
    expect(formatDateString(state.sheetNextDate!)).toBe("2026-06-17");
  });
});
