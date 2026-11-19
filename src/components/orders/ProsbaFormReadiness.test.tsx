/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProsbaFormReadiness, focusProsbaStepField } from "@/components/orders/ProsbaFormReadiness";

beforeAll(() => {
  // happy-dom bez przewijania — w teście liczy się tylko fokus.
  Element.prototype.scrollIntoView ??= () => {};
});
afterEach(() => cleanup());

describe("ProsbaFormReadiness - kroki przenoszą do pól", () => {
  it("krok „Produkt” do uzupełnienia jest przyciskiem i stawia kursor w pierwszym pustym polu produktu", () => {
    render(
      <div>
        <input data-prosba-field="product" defaultValue="ABC-1" aria-label="produkt 1" />
        <input data-prosba-field="product" aria-label="produkt 2" />
        <ProsbaFormReadiness lines={[]} requestKind="zamowienie" salesSubmitPlan={null} />
      </div>
    );
    fireEvent.click(screen.getByRole("button", { name: /^Produkt: .* - przejdź do pola$/ }));
    expect(document.activeElement).toBe(screen.getByLabelText("produkt 2"));
  });

  it("krok bez pola w formularzu (dostawca) zostaje zwykłym tekstem", () => {
    render(<ProsbaFormReadiness lines={[]} requestKind="zamowienie" salesSubmitPlan={null} />);
    expect(screen.queryByRole("button", { name: /^Dostawca:/ })).toBeNull();
    expect(screen.getByText("Dostawca")).toBeTruthy();
  });

  it("w oknie szuka pola tylko w tym oknie, pomija wyłączone", () => {
    render(
      <div>
        <input data-prosba-field="quantity" aria-label="ilość na stronie" />
        <div role="dialog">
          <input data-prosba-field="quantity" disabled aria-label="ilość wyłączona" />
          <input data-prosba-field="quantity" aria-label="ilość w oknie" />
          <span data-testid="start" />
        </div>
      </div>
    );
    expect(focusProsbaStepField(screen.getByTestId("start"), "quantity")).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText("ilość w oknie"));
  });
});
