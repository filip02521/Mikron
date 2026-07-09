import { describe, expect, it } from "vitest";
import {
  canAccessPath,
  canAccessTeethPanel,
  canManageSalesTeam,
  homePathForRole,
  isSalesAccount,
  isSalesManager,
  isZakupyZeby,
  redirectPathAfterLogin,
} from "./auth-roles";

describe("homePathForRole default landing pages", () => {
  it("kieruje handlowca i kierownika na Moje zamówienia", () => {
    expect(homePathForRole("sales")).toBe("/moje");
    expect(homePathForRole("sales_manager")).toBe("/moje");
  });

  it("kieruje administratora na panel dzienny", () => {
    expect(homePathForRole("admin")).toBe("/podsumowanie");
  });

  it("kieruje zakupy na panel dzienny", () => {
    expect(homePathForRole("zakupy")).toBe("/podsumowanie");
  });
});

describe("redirectPathAfterLogin role defaults", () => {
  it("bez next używa domyślnej strony roli", () => {
    expect(redirectPathAfterLogin("sales", null)).toBe("/moje");
    expect(redirectPathAfterLogin("admin", null)).toBe("/podsumowanie");
    expect(redirectPathAfterLogin("zakupy", null)).toBe("/podsumowanie");
    expect(redirectPathAfterLogin("sales", "/")).toBe("/moje");
    expect(redirectPathAfterLogin("admin", "/")).toBe("/podsumowanie");
  });

  it("honoruje dozwolony next zamiast domyślnej strony", () => {
    expect(redirectPathAfterLogin("sales", "/plan")).toBe("/plan");
    expect(redirectPathAfterLogin("admin", "/admin")).toBe("/admin");
    expect(redirectPathAfterLogin("zakupy", "/kolejka")).toBe("/kolejka");
  });

  it("odrzuca niedozwolony next i wraca do domyślnej strony roli", () => {
    expect(redirectPathAfterLogin("sales", "/podsumowanie")).toBe("/moje");
    expect(redirectPathAfterLogin("zakupy", "/moje")).toBe("/podsumowanie");
  });

  it("kieruje kierownika na Moje zamówienia, admin w podglądzie kierownika na Zespół", () => {
    expect(redirectPathAfterLogin("sales_manager", null)).toBe("/moje");
    expect(redirectPathAfterLogin("sales_manager", "/moje")).toBe("/moje");
    expect(redirectPathAfterLogin("sales_manager", "/zespol")).toBe("/zespol");
    expect(redirectPathAfterLogin("admin", null, { adminPanelContext: "sales_manager" })).toBe(
      "/zespol"
    );
  });
});

describe("auth-roles zakupy_zeby", () => {
  it("kieruje zakupy_zeby na kolejkę zębów", () => {
    expect(homePathForRole("zakupy_zeby")).toBe("/zeby/kolejka");
  });

  it("isZakupyZeby rozpoznaje rolę", () => {
    expect(isZakupyZeby("zakupy_zeby")).toBe(true);
    expect(isZakupyZeby("zakupy")).toBe(false);
    expect(isZakupyZeby("admin")).toBe(false);
  });

  it("canAccessTeethPanel zezwala admin i zakupy_zeby", () => {
    expect(canAccessTeethPanel("admin")).toBe(true);
    expect(canAccessTeethPanel("zakupy_zeby")).toBe(true);
    expect(canAccessTeethPanel("zakupy")).toBe(false);
    expect(canAccessTeethPanel("magazyn")).toBe(false);
    expect(canAccessTeethPanel("sales")).toBe(false);
  });

  it("canAccessPath zezwala zakupy_zeby na /zeby, /notatki, /zakupy/tablica, /zakupy/dostawcy", () => {
    expect(canAccessPath("zakupy_zeby", "/zeby/kolejka")).toBe(true);
    expect(canAccessPath("zakupy_zeby", "/notatki")).toBe(true);
    expect(canAccessPath("zakupy_zeby", "/zakupy/tablica")).toBe(true);
    expect(canAccessPath("zakupy_zeby", "/zakupy/dostawcy")).toBe(true);
    expect(canAccessPath("zakupy_zeby", "/podsumowanie")).toBe(true);
  });

  it("canAccessPath odrzuca /moje i /admin", () => {
    expect(canAccessPath("zakupy_zeby", "/moje")).toBe(false);
    expect(canAccessPath("zakupy_zeby", "/admin")).toBe(false);
  });

  it("canAccessPath zezwala na tor dostaw (/kolejka) dzięki funkcji dostawy", () => {
    expect(canAccessPath("zakupy_zeby", "/kolejka")).toBe(true);
  });

  it("canAccessPath zezwala admin na /zeby", () => {
    expect(canAccessPath("admin", "/zeby/kolejka")).toBe(true);
  });

  it("canAccessPath odrzuca zakupy na /zeby", () => {
    expect(canAccessPath("zakupy", "/zeby/kolejka")).toBe(false);
  });

  it("canAccessPath zezwala wszystkim rolom na /ustawienia", () => {
    expect(canAccessPath("sales", "/ustawienia")).toBe(true);
    expect(canAccessPath("sales_manager", "/ustawienia")).toBe(true);
    expect(canAccessPath("admin", "/ustawienia")).toBe(true);
    expect(canAccessPath("zakupy", "/ustawienia")).toBe(true);
    expect(canAccessPath("magazyn", "/ustawienia")).toBe(true);
    expect(canAccessPath("zakupy_zeby", "/ustawienia")).toBe(true);
  });

  it("redirectPathAfterLogin kieruje na /zeby/kolejka", () => {
    expect(redirectPathAfterLogin("zakupy_zeby", null)).toBe("/zeby/kolejka");
    expect(redirectPathAfterLogin("zakupy_zeby", "/zeby/kolejka")).toBe("/zeby/kolejka");
    expect(redirectPathAfterLogin("zakupy_zeby", "/notatki")).toBe("/notatki");
  });

  it("redirectPathAfterLogin honoruje dozwolone ścieżki obu torów", () => {
    expect(redirectPathAfterLogin("zakupy_zeby", "/moje")).toBe("/zeby/kolejka");
    expect(redirectPathAfterLogin("zakupy_zeby", "/kolejka")).toBe("/kolejka");
    expect(redirectPathAfterLogin("zakupy_zeby", "/podsumowanie")).toBe("/podsumowanie");
  });

  it("redirectPathAfterLogin honoruje zapisany obszar pracy", () => {
    expect(
      redirectPathAfterLogin("zakupy_zeby", null, { procurementWorkspace: "dostawy" })
    ).toBe("/podsumowanie");
    expect(
      redirectPathAfterLogin("zakupy_zeby", null, { procurementWorkspace: "zeby" })
    ).toBe("/zeby/kolejka");
  });

  it("canAccessPath z workspace blokuje obcy tor", () => {
    expect(
      canAccessPath("zakupy_zeby", "/podsumowanie", { procurementWorkspace: "zeby" })
    ).toBe(false);
    expect(
      canAccessPath("zakupy_zeby", "/zeby/kolejka", { procurementWorkspace: "zeby" })
    ).toBe(true);
    expect(
      canAccessPath("zakupy_zeby", "/podsumowanie", { procurementWorkspace: "dostawy" })
    ).toBe(true);
    expect(
      canAccessPath("zakupy_zeby", "/zeby/kolejka", { procurementWorkspace: "dostawy" })
    ).toBe(false);
    expect(canAccessPath("zakupy_zeby", "/notatki", { procurementWorkspace: "zeby" })).toBe(
      true
    );
    expect(
      redirectPathAfterLogin("zakupy_zeby", "/podsumowanie", { procurementWorkspace: "zeby" })
    ).toBe("/zeby/kolejka");
  });
});

describe("auth-roles sales_manager", () => {
  it("treats sales_manager as sales account for handlowiec routes", () => {
    expect(isSalesAccount("sales_manager")).toBe(true);
    expect(isSalesManager("sales_manager")).toBe(true);
    expect(canAccessPath("sales_manager", "/moje")).toBe(true);
    expect(canAccessPath("sales_manager", "/prosba")).toBe(true);
    expect(canAccessPath("sales_manager", "/plan")).toBe(true);
  });

  it("allows team management routes only for manager and admin", () => {
    expect(canManageSalesTeam("sales_manager")).toBe(true);
    expect(canManageSalesTeam("admin")).toBe(true);
    expect(canManageSalesTeam("sales")).toBe(false);
    expect(canAccessPath("sales_manager", "/zespol")).toBe(true);
    expect(canAccessPath("sales_manager", "/zespol/handlowcy")).toBe(true);
    expect(canAccessPath("sales_manager", "/zespol/grupy")).toBe(true);
    expect(canAccessPath("sales", "/zespol")).toBe(false);
    expect(canAccessPath("sales", "/zespol/urlopy")).toBe(true);
    expect(canAccessPath("sales", "/zespol/handlowcy")).toBe(false);
    expect(canAccessPath("sales", "/zespol/grupy")).toBe(false);
  });

  it("allows admin sales preview with ?dla=", () => {
    expect(canAccessPath("admin", "/notatnik")).toBe(false);
    expect(canAccessPath("admin", "/notatnik", { previewSalesPersonId: "sp-1" })).toBe(true);
    expect(canAccessPath("admin", "/zk")).toBe(false);
    expect(canAccessPath("admin", "/zk", { previewSalesPersonId: "sp-1" })).toBe(true);
    expect(canAccessPath("admin", "/moje")).toBe(false);
    expect(canAccessPath("admin", "/moje", { previewSalesPersonId: "sp-1" })).toBe(true);
    expect(canAccessPath("admin", "/plan", { previewSalesPersonId: "sp-1" })).toBe(true);
    expect(canAccessPath("admin", "/prosba", { previewSalesPersonId: "sp-1" })).toBe(true);
    expect(canAccessPath("admin", "/tablica", { previewSalesPersonId: "sp-1" })).toBe(true);
    expect(canAccessPath("sales", "/notatnik")).toBe(true);
    expect(canAccessPath("sales", "/zk")).toBe(true);
  });
});

describe("auth-roles admin panel context", () => {
  it("delegates path access to preview context for admin", () => {
    expect(
      canAccessPath("admin", "/kolejka", { adminPanelContext: "magazyn" })
    ).toBe(true);
    expect(
      canAccessPath("admin", "/podsumowanie", { adminPanelContext: "magazyn" })
    ).toBe(false);
    expect(
      canAccessPath("admin", "/admin", { adminPanelContext: "zakupy" })
    ).toBe(false);
    expect(
      canAccessPath("admin", "/moje", { adminPanelContext: "sales" })
    ).toBe(true);
    expect(
      canAccessPath("admin", "/admin/wybor-handlowca", {
        adminPanelContext: "sales",
      })
    ).toBe(true);
  });

  it("keeps full admin access when context is admin", () => {
    expect(
      canAccessPath("admin", "/admin", { adminPanelContext: "admin" })
    ).toBe(true);
    expect(
      canAccessPath("admin", "/podsumowanie", { adminPanelContext: "admin" })
    ).toBe(true);
  });
});

describe("redirectPathAfterLogin admin panel context", () => {
  it("redirects admin to preview home when cookie context is set", () => {
    expect(
      redirectPathAfterLogin("admin", null, { adminPanelContext: "magazyn" })
    ).toBe("/kolejka");
    expect(
      redirectPathAfterLogin("admin", null, { adminPanelContext: "sales" })
    ).toBe("/admin/wybor-handlowca");
  });
});
