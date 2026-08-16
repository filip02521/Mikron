import { describe, expect, it } from "vitest";
import {
  resolveZdEstimateActiveScopeLabel,
  resolveZdEstimateActiveSupplierName,
} from "@/lib/orders/zd-estimate-active-scope";

describe("resolveZdEstimateActiveScopeLabel", () => {
  it("preferuje aktualną grupę nad launch.label", () => {
    expect(
      resolveZdEstimateActiveScopeLabel({
        scopeMode: "grupa",
        selectedGroupName: "Falcon",
        launchMode: "grupa",
        launchLabel: "Polkard",
      })
    ).toBe("Falcon");
  });

  it("preferuje aktualną cechę nad launch.label", () => {
    expect(
      resolveZdEstimateActiveScopeLabel({
        scopeMode: "cecha",
        selectedCechaName: "Ivoclar",
        launchMode: "cecha",
        launchLabel: "Stara cecha",
      })
    ).toBe("Ivoclar");
  });

  it("nie bierze launch.label po przełączeniu trybu Grupa→Cecha", () => {
    expect(
      resolveZdEstimateActiveScopeLabel({
        scopeMode: "cecha",
        selectedCechaName: null,
        launchMode: "grupa",
        launchLabel: "Polkard",
      })
    ).toBeNull();
  });

  it("używa launch.label tylko gdy brak wyboru i ten sam tryb", () => {
    expect(
      resolveZdEstimateActiveScopeLabel({
        scopeMode: "grupa",
        selectedGroupName: null,
        launchMode: "grupa",
        launchLabel: "  Polkard  ",
      })
    ).toBe("Polkard");
  });
});

describe("resolveZdEstimateActiveSupplierName", () => {
  it("preferuje wybranego dostawcę nad launch", () => {
    expect(
      resolveZdEstimateActiveSupplierName({
        selectedSupplierName: "Falcon",
        launchSupplierName: "Polkard",
      })
    ).toBe("Falcon");
  });

  it("fallback do launch gdy brak wybranego", () => {
    expect(
      resolveZdEstimateActiveSupplierName({
        selectedSupplierName: null,
        launchSupplierName: "Polkard",
      })
    ).toBe("Polkard");
  });
});
