/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NewFeatureCallout } from "./NewFeatureCallout";

function renderCallout(until?: string) {
  return render(
    <NewFeatureCallout id="test-feature" title="Nowa rzecz" until={until}>
      Krótki opis.
    </NewFeatureCallout>
  );
}

describe("NewFeatureCallout", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-18T12:00:00+01:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("pokazuje znaczek, tytuł i opis", () => {
    renderCallout();
    expect(screen.getByText("Nowość")).toBeTruthy();
    expect(screen.getByRole("complementary", { name: "Nowa rzecz" }).textContent).toContain("Krótki opis.");
  });

  it("„OK, rozumiem” bez zaznaczenia chowa do następnego wejścia", () => {
    renderCallout();
    fireEvent.click(screen.getByRole("button", { name: "OK, rozumiem" }));
    expect(screen.queryByText("Nowa rzecz")).toBeNull();
    cleanup();
    renderCallout();
    expect(screen.getByText("Nowa rzecz")).toBeTruthy();
  });

  it("z „Nie pokazuj więcej” nie wraca po ponownym wejściu", () => {
    renderCallout();
    fireEvent.click(screen.getByLabelText("Nie pokazuj więcej"));
    fireEvent.click(screen.getByRole("button", { name: "OK, rozumiem" }));
    cleanup();
    renderCallout();
    expect(screen.queryByText("Nowa rzecz")).toBeNull();
    expect(localStorage.getItem("new-feature-dismissed:test-feature")).toBe("1");
  });

  it("po dacie końca znika sam, w ostatni dzień jeszcze jest", () => {
    renderCallout("2026-11-17");
    expect(screen.queryByText("Nowa rzecz")).toBeNull();
    cleanup();
    renderCallout("2026-11-18");
    expect(screen.getByText("Nowa rzecz")).toBeTruthy();
  });
});
