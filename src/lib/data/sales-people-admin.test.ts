import { describe, expect, it } from "vitest";
import {
  formatSalesPersonAccountStatus,
  formatSalesPersonAccountStatusTitle,
  summarizeSalesPersonOrderAttention,
} from "./sales-people-admin-shared";

describe("formatSalesPersonAccountStatus", () => {
  it("pokazuje brak konta bez powiązania", () => {
    expect(
      formatSalesPersonAccountStatus({
        linkedUserEmail: null,
        linkedUserLastSignInAt: null,
        linkedUserLastActivityAt: null,
      })
    ).toBe("Brak konta");
  });

  it("preferuje datę aktywności nad samym logowaniem", () => {
    expect(
      formatSalesPersonAccountStatus({
        linkedUserEmail: "jan@firma.pl",
        linkedUserLastSignInAt: "2026-06-15T08:00:00.000Z",
        linkedUserLastActivityAt: "2026-06-18T10:00:00.000Z",
      })
    ).toBe("Aktyw. 18.06.2026");
  });

  it("pokazuje logowanie gdy brak innej aktywności", () => {
    expect(
      formatSalesPersonAccountStatus({
        linkedUserEmail: "jan@firma.pl",
        linkedUserLastSignInAt: "2026-05-24T14:22:00.000Z",
        linkedUserLastActivityAt: "2026-05-24T14:22:00.000Z",
      })
    ).toBe("Aktyw. 24.05.2026");
  });
});

describe("formatSalesPersonAccountStatusTitle", () => {
  it("rozdziela aktywność i logowanie gdy się różnią", () => {
    expect(
      formatSalesPersonAccountStatusTitle({
        linkedUserEmail: "ola@firma.pl",
        linkedUserCreatedAt: "2026-06-01T08:00:00.000Z",
        linkedUserLastSignInAt: "2026-06-15T08:00:00.000Z",
        linkedUserLastActivityAt: "2026-06-18T09:15:00.000Z",
      })
    ).toBe(
      "Konto od 01.06.2026. Ostatnia aktywność: 18.06.2026. Ostatnie logowanie: 15.06.2026."
    );
  });
});

describe("summarizeSalesPersonOrderAttention", () => {
  const base = {
    sales_person_id: "sp1",
    request_kind: "zamowienie",
    is_teeth: false,
    warehouse_cleared_at: null,
    zd_fulfillment_deadline: null,
  };

  it("liczy otwarte, na regale i po terminie ZD", () => {
    const summary = summarizeSalesPersonOrderAttention(
      [
        { ...base, status: "Zamowione", zd_fulfillment_deadline: "2026-10-05" },
        { ...base, status: "Zamowione", zd_fulfillment_deadline: "2026-10-10" },
        { ...base, status: "Czesciowo_zrealizowane" },
        { ...base, status: "Zrealizowane" },
        { ...base, status: "Zrealizowane", is_teeth: true },
        { ...base, status: "Anulowane", zd_fulfillment_deadline: "2026-01-01" },
      ],
      "2026-10-10"
    ).get("sp1");
    expect(summary).toEqual({ openCount: 3, shelfWaitingCount: 2, overdueZdCount: 1 });
  });
});
