import { describe, expect, it } from "vitest";
import {
  getSalesOnboardingSteps,
  isManagerOnlyOnboardingStep,
  MANAGER_ONLY_ONBOARDING_STEP_IDS,
  salesOnboardingStepCount,
} from "@/lib/sales/sales-onboarding-steps";

describe("sales onboarding steps", () => {
  it("includes core panels for handlowiec", () => {
    const ids = getSalesOnboardingSteps("sales").map((s) => s.id);
    expect(ids).toEqual([
      "welcome",
      "moje",
      "prosba",
      "plan",
      "tablica",
      "notatnik",
      "finish",
    ]);
    expect(salesOnboardingStepCount("sales")).toBe(7);
  });

  it("excludes manager-only steps for handlowiec", () => {
    const ids = getSalesOnboardingSteps("sales").map((s) => s.id);
    for (const managerStepId of MANAGER_ONLY_ONBOARDING_STEP_IDS) {
      expect(ids).not.toContain(managerStepId);
    }
  });

  it("adds team step only for kierownik", () => {
    const ids = getSalesOnboardingSteps("sales_manager").map((s) => s.id);
    expect(ids).toEqual([
      "welcome",
      "moje",
      "prosba",
      "plan",
      "tablica",
      "notatnik",
      "zespol",
      "finish",
    ]);
    expect(salesOnboardingStepCount("sales_manager")).toBe(8);
  });

  it("prosba step describes form flow in screen order", () => {
    const prosba = getSalesOnboardingSteps("sales").find((s) => s.id === "prosba");
    expect(prosba?.bullets[0]).toMatch(/wybierz rodzaj/i);
    expect(prosba?.bullets[1]).toMatch(/Przy informacji/i);
    expect(prosba?.bullets[2]).toMatch(/jednym polu/i);
    expect(prosba?.bullets[3]).toMatch(/klienta końcowego/i);
    expect(prosba?.bullets[3]).toMatch(/Subiekta/i);
  });

  it("moje step mentions client label on rows", () => {
    const moje = getSalesOnboardingSteps("sales").find((s) => s.id === "moje");
    expect(moje?.bullets.some((b) => /klienta końcowego/i.test(b))).toBe(true);
  });

  it("notatnik step describes page top-to-bottom", () => {
    const notatnik = getSalesOnboardingSteps("sales").find((s) => s.id === "notatnik");
    expect(notatnik?.title).toBe("ZK czekające");
    expect(notatnik?.bullets[0]).toMatch(/Do zrobienia dziś/i);
    expect(notatnik?.bullets[1]).toMatch(/Zakładka „ZK”/i);
    expect(notatnik?.bullets[4]).toMatch(/Zakładka „Notatki”/i);
  });

  it("plan step describes open requests before procurement calendar", () => {
    const plan = getSalesOnboardingSteps("sales").find((s) => s.id === "plan");
    expect(plan?.bullets[0]).toMatch(/Z otwartymi prośbami/i);
    expect(plan?.bullets[2]).toMatch(/Plan działu dostaw/i);
  });

  it("tablica step distinguishes board from new request", () => {
    const tablica = getSalesOnboardingSteps("sales").find((s) => s.id === "tablica");
    expect(tablica?.href).toBe("/tablica");
    expect(tablica?.bullets.some((b) => /Ogłoszenia/i.test(b))).toBe(true);
    expect(tablica?.bullets.some((b) => /Nowa prośba/i.test(b))).toBe(true);
  });
});
