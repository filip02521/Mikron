import { describe, expect, it } from "vitest";
import { buildSummaryWorkspace } from "./summary-workspace";
import {
  countDailyPanelNavBadge,
  enrichForSomeoneGroup,
  enrichInformacjaGroup,
  enrichUrgentItem,
  formatPlannerNote,
  formatUrgentVacationHint,
  summarizeDailyInbox,
} from "./procurement-daily-ui";
import type { SummaryStandardItem } from "./summary";
import type { SupplierWithSchedule } from "@/types/database";

function supplier(
  id: string,
  name: string,
  nextDate: string
): SupplierWithSchedule {
  return {
    id,
    name,
    location: "POLSKA",
    pickup_mikran: false,
    pickup_pallet: false,
    notes: "MAILOWO",
    mails: "",
    extra_info: "",
    interval_raw: "2",
    interval_weeks: 2,
    stock_raw: "",
    stock: null,
    stats_mode: "LACZNIE",
    schedule: {
      id: `sch-${id}`,
      supplier_id: id,
      order_date: null,
      shift_date: null,
      computed_next_date: nextDate,
      vacation_note: null,
    },
  } as SupplierWithSchedule;
}

describe("procurement-daily-ui", () => {
  it("summarizeDailyInbox rozdziela zaległe, dziś i prośby", () => {
    const today = new Date(2026, 4, 15);
    const ws = buildSummaryWorkspace(
      [
        supplier("a", "A", "2026-05-14"),
        supplier("b", "B", "2026-05-15"),
      ],
      [
        {
          id: "o1",
          supplier_id: "a",
          sales_person_id: "sp1",
          symbol: "X",
          products: "Wkręt",
          quantity: "1",
          delivered_quantity: "-",
          order_type: "Glowne",
          request_kind: "zamowienie",
          status: "Nowe",
          action_at: null,
          ordered_at: null,
          delivery_at: null,
          supplier: { id: "a", name: "A" } as never,
          sales_person: { id: "sp1", name: "Jan" } as never,
        },
        {
          id: "o2",
          supplier_id: "a",
          sales_person_id: "sp1",
          symbol: "Y",
          products: "Podkładka",
          quantity: "-",
          delivered_quantity: "-",
          order_type: "Glowne",
          request_kind: "informacja",
          status: "Nowe",
          action_at: null,
          ordered_at: null,
          delivery_at: null,
          supplier: { id: "a", name: "A" } as never,
          sales_person: { id: "sp1", name: "Jan" } as never,
        },
      ],
      today,
      [{ id: "sp1", name: "Jan" }]
    );

    const s = summarizeDailyInbox(ws);
    expect(s.overdueCount + s.todayCount).toBe(2);
    expect(s.forSomeoneGroupCount).toBe(1);
    expect(s.forSomeoneLineCount).toBe(1);
    expect(countDailyPanelNavBadge(ws)).toBe(3);
  });

  it("formatUrgentVacationHint opisuje wpływ urlopu", () => {
    const item: SummaryStandardItem = {
      kind: "standard",
      supplierId: "x",
      supplierName: "Test",
      flaggedName: "🇵🇱Test",
      location: "POLSKA",
      nextDate: new Date(2026, 4, 20),
      vacationNote: "PRZESUNIETE_PO",
      notes: "Termin przesunięty (urlop) (20.05)",
      shift: "-",
      status: "-",
      sourceSheet: "POLSKA",
      scheduleId: "s1",
    };
    expect(formatUrgentVacationHint(item)).toContain("po urlopie");
    const ui = enrichUrgentItem(item);
    expect(ui.statusDetail).toContain("20.05");
  });

  it("enrichUrgentItem nadaje czytelny nagłówek", () => {
    const item: SummaryStandardItem = {
      kind: "standard",
      supplierId: "x",
      supplierName: "Test",
      flaggedName: "🇵🇱Test",
      location: "POLSKA",
      nextDate: new Date(2026, 4, 14),
      vacationNote: null,
      notes: "PO TERMINIE (14.05)",
      shift: "-",
      status: "-",
      sourceSheet: "POLSKA",
      scheduleId: "s1",
    };
    const ui = enrichUrgentItem(item);
    expect(ui.headline).toBe("Po terminie");
    expect(ui.statusTitle).toBe("Zaległe");
  });

  it("formatPlannerNote usuwa powtórzenie dnia z notatki", () => {
    expect(formatPlannerNote("Pon (19.05) · urlop skrócony")).toBe("urlop skrócony");
    expect(formatPlannerNote("DO ZAMÓWIENIA DZIŚ")).toBe("DO ZAMÓWIENIA DZIŚ");
  });

  it("countDailyPanelNavBadge liczy zaległe z harmonogramu", () => {
    const today = new Date(2026, 4, 15);
    const ws = buildSummaryWorkspace(
      [supplier("a", "A", "2026-05-14")],
      [],
      today
    );
    expect(summarizeDailyInbox(ws).overdueCount).toBe(1);
    expect(countDailyPanelNavBadge(ws)).toBe(1);
  });

  it("countDailyPanelNavBadge liczy informację z opcją panelu Dziś", () => {
    const today = new Date(2026, 4, 15);
    const ws = buildSummaryWorkspace(
      [],
      [
        {
          id: "info-via-panel",
          supplier_id: "a",
          sales_person_id: "sp1",
          symbol: "X",
          products: "Towar",
          quantity: "-",
          delivered_quantity: "-",
          order_type: "Glowne",
          request_kind: "informacja",
          informacja_queue_via_daily_panel: true,
          status: "Nowe",
          action_at: null,
          ordered_at: null,
          delivery_at: null,
          supplier: { id: "a", name: "A" } as never,
          sales_person: { id: "sp1", name: "Jan" } as never,
        },
      ],
      today,
      [{ id: "sp1", name: "Jan" }]
    );
    expect(countDailyPanelNavBadge(ws)).toBe(1);
    expect(ws.forSomeoneLeft.length).toBe(1);
    expect(ws.informacjaLeft.length).toBe(0);
  });

  it("countDailyPanelNavBadge nie liczy samych prośb informacyjnych", () => {
    const today = new Date(2026, 4, 15);
    const ws = buildSummaryWorkspace(
      [],
      [
        {
          id: "info-only",
          supplier_id: "a",
          sales_person_id: "sp1",
          symbol: "X",
          products: "Towar",
          quantity: "-",
          delivered_quantity: "-",
          order_type: "Glowne",
          request_kind: "informacja",
          status: "Nowe",
          action_at: null,
          ordered_at: null,
          delivery_at: null,
          supplier: { id: "a", name: "A" } as never,
          sales_person: { id: "sp1", name: "Jan" } as never,
        },
      ],
      today,
      [{ id: "sp1", name: "Jan" }]
    );
    expect(countDailyPanelNavBadge(ws)).toBe(0);
    expect(ws.informacjaLeft.length).toBe(1);
  });

  it("enrichForSomeoneGroup i informacja mają różne komunikaty", () => {
    const ws = buildSummaryWorkspace([], [], new Date());
    const zam = enrichForSomeoneGroup({
      kind: "forSomeone",
      supplierId: "a",
      salesPersonId: "sp",
      supplierName: "Dostawca",
      flaggedName: "🇵🇱Dostawca",
      location: "POLSKA",
      person: "Anna",
      displayText: "Anna · 1 produkt",
      hoverNote: "",
      lines: [{ id: "1", products: "X", symbol: "-", quantity: "1" }],
      orderIds: ["1"],
      shift: "[DLA KOGOŚ]",
      status: "-",
      nextDate: new Date(),
    });
    expect(zam.headline).toContain("Anna");
    expect(zam.statusTitle).toBe("Do zamówienia");

    const info = enrichInformacjaGroup({
      kind: "informacja",
      supplierId: "a",
      salesPersonId: "sp",
      supplierName: "Dostawca",
      flaggedName: "🇵🇱Dostawca",
      location: "POLSKA",
      person: "Anna",
      displayText: "Anna · 1 produkt",
      hoverNote: "",
      lines: [{ id: "1", products: "X", symbol: "-", quantity: "-" }],
      orderIds: ["1"],
      shift: "[INFO]",
      status: "-",
      nextDate: new Date(),
    });
    expect(info.headline).toContain("informacja");
    expect(info.statusTitle).toBe("Bez zamówienia");
  });
});
