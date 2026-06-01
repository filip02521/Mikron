import { describe, expect, it } from "vitest";
import { formatSalesPersonAccountStatus } from "./sales-people-admin";

describe("formatSalesPersonAccountStatus", () => {
  it("pokazuje brak konta bez powiązania", () => {
    expect(
      formatSalesPersonAccountStatus({
        linkedUserEmail: null,
        linkedUserLastSignInAt: null,
      })
    ).toBe("Brak konta");
  });

  it("pokazuje brak logowania dla konta bez last_sign_in", () => {
    expect(
      formatSalesPersonAccountStatus({
        linkedUserEmail: "jan@firma.pl",
        linkedUserLastSignInAt: null,
      })
    ).toBe("Nie logował się");
  });

  it("formatuje datę ostatniego logowania", () => {
    expect(
      formatSalesPersonAccountStatus({
        linkedUserEmail: "jan@firma.pl",
        linkedUserLastSignInAt: "2026-05-24T14:22:00.000Z",
      })
    ).toBe("24.05.2026");
  });
});
