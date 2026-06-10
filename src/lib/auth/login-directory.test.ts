import { describe, expect, it } from "vitest";
import {
  filterLoginDirectoryAccounts,
  isAuthUserLoginEligible,
  loginDirectoryDisplayName,
  sortLoginDirectoryAccounts,
  type LoginDirectoryAccount,
} from "./login-directory";

function account(partial: Partial<LoginDirectoryAccount> & Pick<LoginDirectoryAccount, "id" | "email" | "role">): LoginDirectoryAccount {
  return {
    roleLabel: partial.role,
    displayName: partial.displayName ?? partial.email,
    salesPersonName: null,
    ...partial,
  };
}

describe("isAuthUserLoginEligible", () => {
  it("odrzuca anonimowe, bez maila, niepotwierdzone i zbanowane", () => {
    expect(
      isAuthUserLoginEligible({
        email: "jan@mikran.com",
        is_anonymous: false,
        banned_until: null,
        email_confirmed_at: "2026-01-01T00:00:00.000Z",
      })
    ).toBe(true);

    expect(
      isAuthUserLoginEligible({
        email: "jan@mikran.com",
        is_anonymous: true,
        banned_until: null,
        email_confirmed_at: "2026-01-01T00:00:00.000Z",
      })
    ).toBe(false);

    expect(
      isAuthUserLoginEligible({
        email: "",
        is_anonymous: false,
        banned_until: null,
        email_confirmed_at: "2026-01-01T00:00:00.000Z",
      })
    ).toBe(false);

    expect(
      isAuthUserLoginEligible({
        email: "jan@mikran.com",
        is_anonymous: false,
        banned_until: null,
        email_confirmed_at: null,
      })
    ).toBe(false);

    expect(
      isAuthUserLoginEligible({
        email: "jan@mikran.com",
        is_anonymous: false,
        banned_until: "2099-01-01T00:00:00.000Z",
        email_confirmed_at: "2026-01-01T00:00:00.000Z",
      })
    ).toBe(false);
  });
});

describe("loginDirectoryDisplayName", () => {
  it("preferuje nazwę handlowca", () => {
    expect(
      loginDirectoryDisplayName({
        email: "anna@mikran.com",
        salesPersonName: "Anna Kowalska",
      })
    ).toBe("Anna Kowalska");
  });

  it("buduje nazwę z lokalnej części e-maila", () => {
    expect(loginDirectoryDisplayName({ email: "jan.kowalski@mikran.com" })).toBe(
      "Jan Kowalski"
    );
    expect(loginDirectoryDisplayName({ email: "zakupy@mikran.com" })).toBe("Zakupy");
  });

  it("kapitalizuje nazwę handlowca z małych liter", () => {
    expect(
      loginDirectoryDisplayName({
        email: "anna@mikran.com",
        salesPersonName: "anna kowalska",
      })
    ).toBe("Anna Kowalska");
  });
});

describe("sortLoginDirectoryAccounts", () => {
  it("sortuje po roli, potem alfabetycznie", () => {
    const sorted = sortLoginDirectoryAccounts([
      account({ id: "1", email: "z@m.com", role: "sales", roleLabel: "Handlowiec", displayName: "Zofia" }),
      account({ id: "2", email: "a@m.com", role: "admin", roleLabel: "Administrator", displayName: "Admin" }),
      account({ id: "3", email: "b@m.com", role: "sales", roleLabel: "Handlowiec", displayName: "Basia" }),
    ]);

    expect(sorted.map((a) => a.displayName)).toEqual(["Admin", "Basia", "Zofia"]);
  });
});

describe("filterLoginDirectoryAccounts", () => {
  const rows = [
    account({
      id: "1",
      email: "anna@mikran.com",
      role: "sales",
      roleLabel: "Handlowiec",
      displayName: "Anna Kowalska",
      salesPersonName: "Anna Kowalska",
    }),
    account({
      id: "2",
      email: "zakupy@mikran.com",
      role: "zakupy",
      roleLabel: "Dział zakupów",
      displayName: "Zakupy",
    }),
  ];

  it("filtruje po imieniu i nazwisku", () => {
    expect(filterLoginDirectoryAccounts(rows, "anna")).toHaveLength(1);
    expect(filterLoginDirectoryAccounts(rows, "kowalska")).toHaveLength(1);
    expect(filterLoginDirectoryAccounts(rows, "zakupy")).toHaveLength(1);
    expect(filterLoginDirectoryAccounts(rows, "dział")).toHaveLength(0);
    expect(filterLoginDirectoryAccounts(rows, "zakupy@mikran.com")).toHaveLength(0);
  });
});
