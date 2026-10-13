/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ManagerPreviewBanner } from "./ManagerPreviewBanner";

describe("baner podglądu administratora", () => {
  afterEach(() => cleanup());

  it("tytuł nie powtarza nagłówka strony, bieżący widok jest oznaczony", () => {
    render(<ManagerPreviewBanner salesPersonName="Osoba A" salesPersonId="sp-1" scope="zk" readOnly />);
    expect(screen.getByText("Podgląd administratora - tylko odczyt")).toBeTruthy();
    expect(screen.queryByText(/Podgląd ZK czekających: Osoba A/)).toBeNull();
    const nav = screen.getByRole("navigation", { name: "Panel: Osoba A" });
    expect(nav.querySelector("[aria-current=page]")?.textContent).toBe("ZK");
    expect(screen.getByRole("link", { name: "Plan" }).getAttribute("href")).toBe("/plan?dla=sp-1");
  });
});
