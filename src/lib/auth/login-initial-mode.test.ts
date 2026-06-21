import { describe, expect, it } from "vitest";
import {
  buildLoginPageHref,
  loginFormModeFromParam,
  resolveInitialManualEmailLogin,
  shouldPreferAccountPickerAfterHydration,
} from "./login-initial-mode";

describe("resolveInitialManualEmailLogin", () => {
  it("domyślnie pokazuje e-mail bez preloadu katalogu", () => {
    expect(
      resolveInitialManualEmailLogin({
        preloadedAccountCount: 0,
        modeParam: null,
      })
    ).toBe(true);
  });

  it("szanuje ?mode=picker", () => {
    expect(
      resolveInitialManualEmailLogin({
        preloadedAccountCount: 0,
        modeParam: "picker",
      })
    ).toBe(false);
  });

  it("zostawia picker w trybie preload (E2E)", () => {
    expect(
      resolveInitialManualEmailLogin({
        preloadedAccountCount: 3,
        modeParam: null,
      })
    ).toBe(false);
  });
});

describe("shouldPreferAccountPickerAfterHydration", () => {
  it("przełącza na picker, gdy są zapisane konta bez cache quick login", () => {
    expect(
      shouldPreferAccountPickerAfterHydration({
        preloadedAccountCount: 0,
        modeParam: null,
        recentAccountIds: ["acc-1"],
      })
    ).toBe(true);
  });

  it("nie nadpisuje jawnego ?mode=email", () => {
    expect(
      shouldPreferAccountPickerAfterHydration({
        preloadedAccountCount: 0,
        modeParam: "email",
        recentAccountIds: ["acc-1"],
      })
    ).toBe(false);
  });
});

describe("buildLoginPageHref", () => {
  it("zachowuje next i reason w linku trybu", () => {
    expect(
      buildLoginPageHref("email", {
        next: "/moje",
        reason: "session",
      })
    ).toBe("/login?mode=email&next=%2Fmoje&reason=session");
  });

  it("bez trybu zwraca czysty /login", () => {
    expect(buildLoginPageHref(null, { next: null, reason: null })).toBe("/login");
  });

  it("parsuje param trybu", () => {
    expect(loginFormModeFromParam("email")).toBe("email");
    expect(loginFormModeFromParam("picker")).toBe("picker");
    expect(loginFormModeFromParam("x")).toBeNull();
  });
});
