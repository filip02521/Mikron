import { describe, expect, it } from "vitest";
import { parseSalesPersonAndClient } from "./sales-person-alias";

describe("parseSalesPersonAndClient", () => {
  it("dzieli handlowca i klienta po slashu", () => {
    expect(parseSalesPersonAndClient("Damian / Best Poznań")).toEqual({
      salesName: "Damian",
      clientName: "Best Poznań",
    });
  });

  it("normalizuje skróty", () => {
    expect(parseSalesPersonAndClient("K.J / stan")).toEqual({
      salesName: "Kasia J.",
      clientName: "stan",
    });
  });

  it("bez slasha zwraca tylko handlowca", () => {
    expect(parseSalesPersonAndClient("Ola G.")).toEqual({
      salesName: "Ola G.",
      clientName: null,
    });
  });
});
