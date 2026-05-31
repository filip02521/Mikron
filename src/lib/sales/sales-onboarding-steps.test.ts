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
    expect(ids).toEqual(["welcome", "moje", "prosba", "plan", "notatnik", "finish"]);
    expect(salesOnboardingStepCount("sales")).toBe(6);
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
      "notatnik",
      "zespol",
      "finish",
    ]);
    expect(salesOnboardingStepCount("sales_manager")).toBe(7);
  });

  it("prosba step describes form flow in screen order", () => {
    const prosba = getSalesOnboardingSteps("sales").find((s) => s.id === "prosba");
    expect(prosba?.bullets[0]).toMatch(/Na początku wybierasz rodzaj/i);
    expect(prosba?.bullets[1]).toMatch(/Potem dodajesz produkty/i);
  });

  it("notatnik step describes page top-to-bottom", () => {
    const notatnik = getSalesOnboardingSteps("sales").find((s) => s.id === "notatnik");
    expect(notatnik?.bullets[0]).toMatch(/Do zrobienia dziś/i);
    expect(notatnik?.bullets[2]).toMatch(/Czeka na towar/i);
  });

  it("plan step describes open requests before procurement calendar", () => {
    const plan = getSalesOnboardingSteps("sales").find((s) => s.id === "plan");
    expect(plan?.bullets[0]).toMatch(/Z otwartymi prośbami/i);
    expect(plan?.bullets[2]).toMatch(/Plan działu dostaw/i);
  });
});
