import { describe, expect, it } from "vitest";
import {
  buildOnboardingMojePresented,
  buildOnboardingMojeArchiveDemo,
  buildOnboardingNotepadDemo,
  buildOnboardingPlanDemo,
  buildOnboardingProsbaLines,
} from "@/lib/sales/sales-onboarding-demo-data";

describe("sales onboarding demo data", () => {
  it("includes pickup row ready for acknowledgement in moje demo", () => {
    const demo = buildOnboardingMojePresented();
    const pickup = demo.zamowienia.find((r) => r.id === "demo-pickup");
    expect(pickup).toBeDefined();
    expect(pickup?.acknowledgeMode).toBe("pickup");
    expect(pickup?.pickupPendingCount).toBe(1);
    expect(pickup?.pickupPendingIds).toEqual(["demo-l1"]);
  });

  it("includes archived rows for moje tour", () => {
    const archive = buildOnboardingMojeArchiveDemo();
    expect(archive.archiwumRecent).toHaveLength(2);
    expect(archive.archiwumRecent.some((r) => r.statusTitle === "Odebrane z magazynu")).toBe(true);
    expect(archive.archiwumRecent.some((r) => r.kind === "informacja")).toBe(true);
  });

  it("prefills prosba lines for onboarding", () => {
    const lines = buildOnboardingProsbaLines("sp-1");
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.salesPersonId === "sp-1")).toBe(true);
  });

  it("uses relative dates in plan and notepad demos", () => {
    const plan = buildOnboardingPlanDemo();
    const orderA = plan.suppliers[0]?.schedule?.order_date;
    const orderB = plan.suppliers[1]?.schedule?.order_date;
    expect(orderA).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(orderB).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(orderA).not.toBe("2026-06-02");

    const notepad = buildOnboardingNotepadDemo("sp-1");
    expect(notepad.zkWatches).toHaveLength(2);
    expect(notepad.notes[0]?.follow_up_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(notepad.notes[0]?.follow_up_at).not.toBe("2026-05-28");
  });
});
