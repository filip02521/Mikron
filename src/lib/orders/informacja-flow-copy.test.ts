import { describe, expect, it } from "vitest";
import {
  informacjaReadyAckSubline,
  informacjaReadyDayStartSubtitle,
  informacjaReadyDayStartTitle,
  resolveInformacjaArrivedSourceMix,
} from "./informacja-flow-copy";

describe("resolveInformacjaArrivedSourceMix", () => {
  it("null gdy brak źródeł", () => {
    expect(resolveInformacjaArrivedSourceMix([null, undefined])).toBeNull();
  });

  it("stock_auto gdy wszystkie auto", () => {
    expect(resolveInformacjaArrivedSourceMix(["stock_auto", "stock_auto"])).toBe(
      "stock_auto"
    );
  });

  it("mixed gdy auto i manual", () => {
    expect(resolveInformacjaArrivedSourceMix(["stock_auto", "manual"])).toBe("mixed");
  });
});

describe("informacjaReadyAckSubline", () => {
  it("auto — Subiekt, nie magazyn", () => {
    expect(
      informacjaReadyAckSubline({ sourceMix: "stock_auto", informacjaPath: "direct" })
    ).toContain("Subiekcie");
    expect(
      informacjaReadyAckSubline({ sourceMix: "stock_auto", informacjaPath: "direct" })
    ).not.toContain("magazynu");
  });

  it("manual direct — neutralne powiadomienie", () => {
    expect(
      informacjaReadyAckSubline({ sourceMix: "manual", informacjaPath: "direct" })
    ).toBe("Potwierdź, że widziałeś/aś powiadomienie o dostępności");
  });

  it("manual via_panel — magazyn potwierdził", () => {
    expect(
      informacjaReadyAckSubline({ sourceMix: "manual", informacjaPath: "via_panel" })
    ).toContain("Magazyn potwierdził");
  });
});

describe("informacjaReadyDayStartSubtitle", () => {
  it("auto — stan Subiekta", () => {
    expect(
      informacjaReadyDayStartSubtitle([
        { informacjaArrivedSourceMix: "stock_auto", informacjaPath: "direct" },
      ])
    ).toContain("Subiekcie");
  });

  it("manual direct — nie zakupy", () => {
    expect(
      informacjaReadyDayStartSubtitle([
        { informacjaArrivedSourceMix: "manual", informacjaPath: "direct" },
      ])
    ).not.toContain("Zakupy");
  });
});

describe("informacjaReadyDayStartTitle", () => {
  it("liczba mnoga", () => {
    expect(informacjaReadyDayStartTitle(3)).toContain("(3)");
  });
});
