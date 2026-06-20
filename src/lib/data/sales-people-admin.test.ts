import { describe, expect, it } from "vitest";
import {
  formatSalesPersonAccountStatus,
  formatSalesPersonAccountStatusTitle,
} from "./sales-people-admin";

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
