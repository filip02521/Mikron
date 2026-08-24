import { describe, expect, it } from "vitest";
import {
  zdEstimateStickyToastBottomClass,
  zdEstimateStickyToastStackIndices,
} from "@/lib/orders/zd-estimate-sticky-toast-stack";
import {
  floatingToastAboveZdStickyClass,
  floatingToastAboveZdStickyStackClass,
  floatingToastAboveZdStickyTallClass,
} from "@/lib/ui/sales-mobile-chrome";

describe("zdEstimateStickyToastStackIndices", () => {
  it("nadaje kolejne piętra od dołu", () => {
    expect(
      zdEstimateStickyToastStackIndices({
        launchReady: true,
        sessionRestored: true,
        recount: false,
        settingsLive: true,
      })
    ).toEqual({
      launchReady: 0,
      sessionRestored: 1,
      settingsLive: 2,
    });
  });

  it("pusta mapa gdy nic nie widać", () => {
    expect(zdEstimateStickyToastStackIndices({})).toEqual({});
  });
});

describe("zdEstimateStickyToastBottomClass", () => {
  it("index 0 / 1 używa klas chrome", () => {
    expect(
      zdEstimateStickyToastBottomClass({ stackIndex: 0, tallDock: false })
    ).toBe(floatingToastAboveZdStickyClass);
    expect(
      zdEstimateStickyToastBottomClass({ stackIndex: 1, tallDock: false })
    ).toBe(floatingToastAboveZdStickyStackClass);
    expect(
      zdEstimateStickyToastBottomClass({ stackIndex: 0, tallDock: true })
    ).toBe(floatingToastAboveZdStickyTallClass);
  });

  it("wyższe indexy mają osobne bottom (bez kolizji z 0/1)", () => {
    const a = zdEstimateStickyToastBottomClass({
      stackIndex: 2,
      tallDock: false,
    });
    const b = zdEstimateStickyToastBottomClass({
      stackIndex: 0,
      tallDock: false,
    });
    expect(a).not.toBe(b);
    expect(a).toContain("bottom-[");
  });
});
