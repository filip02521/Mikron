import { describe, expect, it } from "vitest";
import {
  myOrderFriendlyStatusHint,
  myOrderFriendlyStatusLabel,
} from "./my-order-friendly-status";

describe("myOrderFriendlyStatusLabel", () => {
  it("tłumaczy statusy techniczne", () => {
    expect(myOrderFriendlyStatusLabel("W dziale dostaw")).toBe("Sprawdzamy Twoją prośbę");
    expect(myOrderFriendlyStatusLabel("Zamówione")).toBe("Zamówione — czekamy na dostawę");
  });

  it("zostawia nieznane bez zmian", () => {
    expect(myOrderFriendlyStatusLabel("Custom status")).toBe("Custom status");
  });
});

describe("myOrderFriendlyStatusHint", () => {
  it("daje podpowiedź dla weryfikacji", () => {
    expect(myOrderFriendlyStatusHint("W dziale dostaw")).toContain("Nie musisz");
  });
});
