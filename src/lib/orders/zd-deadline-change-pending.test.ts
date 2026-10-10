import { describe, expect, it } from "vitest";
import { zdDeadlineChangeNeedsClick } from "./zd-deadline-change-pending";

const change = (variant: "postponed" | "moved_earlier" | "first_confirmed") => ({
  previousDeadline: "2026-10-01",
  currentDeadline: "2026-10-08",
  changedAt: "2026-10-01T10:00:00Z",
  variant,
  title: "Zmiana terminu",
  detail: "",
});

describe("zdDeadlineChangeNeedsClick", () => {
  it("przesunięcie i przyspieszenie wymagają kliknięcia, pierwsze ustalenie nie", () => {
    expect(zdDeadlineChangeNeedsClick(change("postponed"))).toBe(true);
    expect(zdDeadlineChangeNeedsClick(change("moved_earlier"))).toBe(true);
    expect(zdDeadlineChangeNeedsClick(change("first_confirmed"))).toBe(false);
  });
});
