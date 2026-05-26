import { describe, expect, it } from "vitest";
import { isNavItemActive, pageTitle } from "./nav";

describe("isNavItemActive", () => {
  const zespolSiblings = ["/zespol", "/zespol/handlowcy", "/zespol/grupy"];

  it("podświetla tylko handlowcy na /zespol/handlowcy", () => {
    const pathname = "/zespol/handlowcy";
    expect(isNavItemActive(pathname, "/zespol", zespolSiblings)).toBe(false);
    expect(isNavItemActive(pathname, "/zespol/handlowcy", zespolSiblings)).toBe(true);
  });

  it("podświetla podgląd na /zespol", () => {
    const pathname = "/zespol";
    expect(isNavItemActive(pathname, "/zespol", zespolSiblings)).toBe(true);
    expect(isNavItemActive(pathname, "/zespol/handlowcy", zespolSiblings)).toBe(false);
  });

  it("podświetla grupy na /zespol/grupy", () => {
    const pathname = "/zespol/grupy";
    expect(isNavItemActive(pathname, "/zespol", zespolSiblings)).toBe(false);
    expect(isNavItemActive(pathname, "/zespol/grupy", zespolSiblings)).toBe(true);
  });
});

describe("pageTitle", () => {
  it("zwraca Handlowcy i konta dla /zespol/handlowcy", () => {
    expect(pageTitle("/zespol/handlowcy")).toBe("Handlowcy i konta");
  });

  it("zwraca Grupy zespołu dla /zespol/grupy (admin w menu)", () => {
    expect(pageTitle("/zespol/grupy")).toBe("Grupy zespołu");
  });
});
