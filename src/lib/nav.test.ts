import { describe, expect, it } from "vitest";
import { isNavItemActive, pageTitle } from "./nav";

describe("isNavItemActive", () => {
  const zespolSiblings = ["/zespol", "/zespol/handlowcy"];

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
});

describe("pageTitle", () => {
  it("zwraca Handlowcy i konta dla /zespol/handlowcy", () => {
    expect(pageTitle("/zespol/handlowcy")).toBe("Handlowcy i konta");
  });
});
