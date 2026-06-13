import { describe, expect, it } from "vitest";
import {
  getSalesOnboardingSteps,
  MANAGER_ONLY_ONBOARDING_STEP_IDS,
  salesOnboardingStepCount,
} from "@/lib/sales/sales-onboarding-steps";
import {
  INFORMACJA_FLOW_DIRECT,
  INFORMACJA_FLOW_STOCK_OUT,
} from "@/lib/orders/informacja-flow-copy";

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

  it("welcome orients user in first screen", () => {
    const welcome = getSalesOnboardingSteps("sales").find((s) => s.id === "welcome");
    expect(welcome?.bullets.some((b) => /Nowa prośba/i.test(b))).toBe(true);
    expect(welcome?.bullets.some((b) => /Harmonogram/i.test(b))).toBe(true);
    expect(welcome?.bullets.some((b) => /Tablica/i.test(b))).toBe(true);
    expect(welcome?.bullets.some((b) => /ZK czekające/i.test(b))).toBe(true);
    expect(welcome?.bullets.some((b) => /E-mail/i.test(b))).toBe(true);
    expect(welcome?.bullets.some((b) => /Menu będzie chwilowo wyłączone/i.test(b))).toBe(true);
  });

  it("manager welcome mentions team preview step", () => {
    const welcome = getSalesOnboardingSteps("sales_manager").find((s) => s.id === "welcome");
    expect(welcome?.bullets.some((b) => /Podgląd zespołu/i.test(b))).toBe(true);
  });

  it("covers every primary sales nav item with a tour step", () => {
    const steps = getSalesOnboardingSteps("sales");
    const hrefs = steps.map((s) => s.href).filter(Boolean);
    expect(hrefs).toContain("/moje");
    expect(hrefs).toContain("/prosba");
    expect(hrefs).toContain("/plan");
    expect(hrefs).toContain("/tablica");
    expect(hrefs).toContain("/zk");
  });

  it("manager tour adds zespol step with nav label", () => {
    const zespol = getSalesOnboardingSteps("sales_manager").find((s) => s.id === "zespol");
    expect(zespol?.href).toBe("/zespol");
    expect(zespol?.navLabel).toBe("Podgląd zespołu");
  });

  it("prosba step uses informacja labels from flow copy", () => {
    const prosba = getSalesOnboardingSteps("sales").find((s) => s.id === "prosba");
    expect(prosba?.bullets[0]).toMatch(/wybierz rodzaj/i);
    expect(prosba?.bullets[0]).toMatch(/Informacja o towarze/i);
    expect(prosba?.bullets[1]).toContain(INFORMACJA_FLOW_DIRECT.label);
    expect(prosba?.bullets[1]).toContain(INFORMACJA_FLOW_STOCK_OUT.label);
    expect(prosba?.bullets[2]).toMatch(/jednym polu/i);
    expect(prosba?.bullets[3]).toMatch(/klienta końcowego/i);
    expect(prosba?.navLabel).toBe("Nowa prośba");
  });

  it("moje step mentions client label and informacja section", () => {
    const moje = getSalesOnboardingSteps("sales").find((s) => s.id === "moje");
    expect(moje?.bullets.some((b) => /klienta końcowego/i.test(b))).toBe(true);
    expect(moje?.bullets.some((b) => /Tylko sprawdzamy dostępność/i.test(b))).toBe(true);
    expect(moje?.navLabel).toBe("Moje zamówienia");
  });

  it("notatnik step describes page top-to-bottom", () => {
    const notatnik = getSalesOnboardingSteps("sales").find((s) => s.id === "notatnik");
    expect(notatnik?.title).toBe("ZK czekające");
    expect(notatnik?.navLabel).toBe("ZK czekające");
    expect(notatnik?.bullets[0]).toMatch(/Do zrobienia dziś/i);
    expect(notatnik?.bullets[1]).toMatch(/Zakładka „ZK”/i);
    expect(notatnik?.bullets[4]).toMatch(/Zakładka „Notatki”/i);
  });

  it("plan step describes open requests before procurement calendar", () => {
    const plan = getSalesOnboardingSteps("sales").find((s) => s.id === "plan");
    expect(plan?.bullets[0]).toMatch(/Z otwartymi prośbami/i);
    expect(plan?.bullets[2]).toMatch(/Plan działu dostaw/i);
  });

  it("tablica step uses full tab labels and distinguishes from prośba", () => {
    const tablica = getSalesOnboardingSteps("sales").find((s) => s.id === "tablica");
    expect(tablica?.href).toBe("/tablica");
    expect(tablica?.bullets.some((b) => /Ogłoszenia od zakupów/i.test(b))).toBe(true);
    expect(tablica?.bullets.some((b) => /Pytania zespołu/i.test(b))).toBe(true);
    expect(tablica?.bullets.some((b) => /Nowa prośba/i.test(b))).toBe(true);
    expect(tablica?.bullets.some((b) => /P:/i.test(b))).toBe(false);
  });

  it("finish step aligns email messaging with welcome", () => {
    const finish = getSalesOnboardingSteps("sales").find((s) => s.id === "finish");
    expect(finish?.bullets.some((b) => /E-mail/i.test(b))).toBe(true);
    expect(finish?.bullets.some((b) => /aplikacji na bieżąco/i.test(b))).toBe(true);
  });
});
