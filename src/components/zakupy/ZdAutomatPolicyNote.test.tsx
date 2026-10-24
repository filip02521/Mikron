/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ZdAutomatPolicyBadge, ZdAutomatPolicyCardNote } from "./ZdAutomatPolicyNote";

afterEach(cleanup);

const polkard = { strategy: "max30_90" as const, targetDays: 25, cycleDays: 2, autoProposals: true };

describe("Automat ZD przy cyklu z karty", () => {
  it("wiersz Terminów: krótka etykieta z rytmem automatu, pełna w podpowiedzi", () => {
    const { container, getByText } = render(<ZdAutomatPolicyBadge policy={polkard} />);
    expect(getByText("Automat ZD · co 2 dni")).toBeTruthy();
    expect(container.querySelector("[title]")?.getAttribute("title")).toContain("tylko przypomnienia w Terminach zamówień");
  });
  it("karta dostawcy: cel, rytm, znaczenie pól karty i link do ustawień", () => {
    const { getByText, getByRole } = render(<ZdAutomatPolicyCardNote policy={{ ...polkard, cycleDays: 1 }} />);
    expect(getByText("Automat ZD · 25 dni zapasu · codziennie · propozycje")).toBeTruthy();
    expect(getByText(/Zapas - okno sprzedaży/)).toBeTruthy();
    expect(getByRole("link", { name: "Ustawienia automatu" }).getAttribute("href")).toBe("/zakupy/automat");
  });
});
