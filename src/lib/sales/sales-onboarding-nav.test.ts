import { describe, expect, it } from "vitest";
import {
  resolveTourStepIndexFromPathname,
  shouldBlockTourPathSync,
  stepPathnameForStep,
} from "@/lib/sales/sales-onboarding-nav";
import { getSalesOnboardingSteps } from "@/lib/sales/sales-onboarding-steps";

describe("sales onboarding nav", () => {
  const handlowiecSteps = getSalesOnboardingSteps("sales");
  const managerSteps = getSalesOnboardingSteps("sales_manager");

  it("maps step hrefs to pathnames", () => {
    expect(stepPathnameForStep(handlowiecSteps[1]!)).toBe("/moje");
    expect(stepPathnameForStep(handlowiecSteps[handlowiecSteps.length - 1]!)).toBeNull();
    expect(stepPathnameForStep(handlowiecSteps[0]!)).toBeNull();
  });

  it("resolves pathname to step index", () => {
    expect(resolveTourStepIndexFromPathname(handlowiecSteps, "/prosba")).toBe(2);
    expect(resolveTourStepIndexFromPathname(handlowiecSteps, "/tablica")).toBe(4);
    expect(resolveTourStepIndexFromPathname(handlowiecSteps, "/notatnik")).toBe(6);
    expect(resolveTourStepIndexFromPathname(handlowiecSteps, "/zk")).toBe(5);
    expect(resolveTourStepIndexFromPathname(handlowiecSteps, "/nieznane")).toBeNull();
  });

  it("keeps finish step when already on finish", () => {
    const finishIndex = handlowiecSteps.findIndex((s) => s.id === "finish");
    expect(
      resolveTourStepIndexFromPathname(handlowiecSteps, "/zk", finishIndex)
    ).toBe(finishIndex);
    expect(resolveTourStepIndexFromPathname(handlowiecSteps, "/moje", 1)).toBe(1);
  });

  it("includes zespol route for manager", () => {
    const zespolIndex = managerSteps.findIndex((s) => s.id === "zespol");
    expect(zespolIndex).toBeGreaterThan(0);
    expect(resolveTourStepIndexFromPathname(managerSteps, "/zespol")).toBe(zespolIndex);
  });

  it("does not resolve zespol for handlowiec steps", () => {
    expect(resolveTourStepIndexFromPathname(handlowiecSteps, "/zespol")).toBeNull();
  });

  it("blocks path sync while pending navigation has not arrived", () => {
    const planIndex = handlowiecSteps.findIndex((s) => s.id === "plan");
    expect(shouldBlockTourPathSync(handlowiecSteps, planIndex, "/prosba")).toBe(true);
    expect(shouldBlockTourPathSync(handlowiecSteps, planIndex, "/plan")).toBe(false);
  });

  it("does not block path sync for finish step", () => {
    const finishIndex = handlowiecSteps.findIndex((s) => s.id === "finish");
    expect(shouldBlockTourPathSync(handlowiecSteps, finishIndex, "/zk")).toBe(false);
  });
});
