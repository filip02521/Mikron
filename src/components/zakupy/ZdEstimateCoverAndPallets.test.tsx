/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { ZdEstimateCoverCell } from "./ZdEstimateTableRow";
import { ZdEstimateDoZdCell } from "./ZdEstimateDoZdCell";
import { computeZdPackOrderQty, formatZdPackCompactLabel } from "@/lib/orders/zd-estimate-packaging";

describe("Starczy: minipasek z kreską czasu dostawy", () => {
  afterEach(() => cleanup());

  it("zapas krótszy niż dostawa → pasek na czerwono i opis dla czytnika", () => {
    const { container } = render(
      <ZdEstimateCoverCell line={{ dostepne: 8, sprzedazDziennie: 2 }} leadDays={9} />
    );
    expect(container.querySelector(".zd-est-cover-fill--short")).not.toBeNull();
    expect(container.querySelector(".sr-only")?.textContent).toContain("Zabraknie przed dostawą");
  });

  it("zapas dłuższy niż dostawa → bez czerwieni", () => {
    const { container } = render(
      <ZdEstimateCoverCell line={{ dostepne: 40, sprzedazDziennie: 2 }} leadDays={9} />
    );
    expect(container.querySelector(".zd-est-cover-fill--short")).toBeNull();
    expect(container.querySelector(".sr-only")?.textContent).toContain("Starczy do dostawy");
  });

  it("bez czasu dostawy → sama liczba dni, bez paska", () => {
    const { container } = render(
      <ZdEstimateCoverCell line={{ dostepne: 8, sprzedazDziennie: 2 }} leadDays={null} />
    );
    expect(container.querySelector(".zd-est-cover-track")).toBeNull();
  });
});

describe("Do ZD: znacznik pełnych palet", () => {
  afterEach(() => cleanup());

  it("72 worki przy palecie 36 → „2 pal.”", () => {
    const { container } = render(
      <ZdEstimateDoZdCell qty={computeZdPackOrderQty(300, 5, "worek", "packages", 36)} />
    );
    expect(container.querySelector(".zd-est-dozd-pallets")?.textContent).toBe("2 pal.");
  });

  it("bez palet albo niepełna paleta z nadpisania → bez znacznika", () => {
    const { container } = render(
      <ZdEstimateDoZdCell qty={computeZdPackOrderQty(300, 5, "worek", "packages", null)} />
    );
    expect(container.querySelector(".zd-est-dozd-pallets")).toBeNull();
    cleanup();
    const over = render(
      <ZdEstimateDoZdCell
        qty={computeZdPackOrderQty(300, 5, "worek", "packages", 36)}
        overrideZdUnits={10}
        onOverrideChange={() => undefined}
      />
    );
    expect(over.container.querySelector(".zd-est-dozd-pallets")).toBeNull();
  });

  it("skrót etykiety „worek” mieści się w kolumnie jednostki", () => {
    expect(formatZdPackCompactLabel("worek")).toBe("wor.");
  });
});

describe("ZdEstimateDoZdCell — porównanie ze strategią „jak dotąd”", () => {
  afterEach(() => cleanup());

  it("inna ilość → porównanie tylko w dymku komórki (bez dopisku pod liczbą); ta sama albo brak → nic", () => {
    const qty = computeZdPackOrderQty(10, 1, "op.");
    const a = render(<ZdEstimateDoZdCell qty={qty} comparePieces={14} />);
    expect(a.container.textContent).not.toContain("dotąd");
    expect(a.container.querySelector(".zd-est-dozd")?.getAttribute("title")).toContain("Stara strategia: 14 szt (teraz 10 szt)");
    cleanup();
    const b = render(<ZdEstimateDoZdCell qty={qty} comparePieces={qty.piecesArriving} />);
    expect(b.container.querySelector(".zd-est-dozd")?.getAttribute("title") ?? "").not.toContain("Stara strategia");
    cleanup();
    const c = render(<ZdEstimateDoZdCell qty={qty} />);
    expect(c.container.querySelector(".zd-est-dozd")?.getAttribute("title") ?? "").not.toContain("Stara strategia");
  });
});

describe("ZdEstimateDoZdCell — porównanie w sztukach przy zmianie opakowania", () => {
  afterEach(() => cleanup());

  it("to samo w sztukach, choć wiersz jest teraz w opakowaniach → bez znacznika", () => {
    // „jak dotąd” 120 szt; po Policz ustawione opakowanie 12 szt → 10 op. = 120 szt
    const qty = computeZdPackOrderQty(120, 12, "op.", "packages");
    const r = render(<ZdEstimateDoZdCell qty={qty} comparePieces={120} />);
    expect(r.container.querySelector(".zd-est-dozd")?.getAttribute("title") ?? "").not.toContain("Stara strategia");
  });
});

describe("ZdEstimateDoZdCell — pozycja do sprawdzenia", () => {
  afterEach(() => cleanup());

  it("jeden sygnał: przycisk „Akceptuj” (procent w dymku), a po akceptacji nic pod liczbą", () => {
    const qty = computeZdPackOrderQty(10, 1, "op.");
    const onAccept = vi.fn();
    const r = render(<ZdEstimateDoZdCell qty={qty} confidence={0.82} qtyReview onAccept={onAccept} />);
    const btn = r.getByRole("button", { name: /Zaakceptuj weryfikację: 82%/ });
    expect(btn.textContent).toBe("Akceptuj");
    expect(r.container.querySelector(".zd-est-dozd-hint-row")?.textContent).not.toMatch(/%/);
    fireEvent.click(btn);
    expect(onAccept).toHaveBeenCalledTimes(1);
    cleanup();
    const done = render(<ZdEstimateDoZdCell qty={qty} confidence={0.82} qtyReview accepted onAccept={onAccept} />);
    expect(done.queryByRole("button", { name: /Zaakceptuj/ })).toBeNull();
  });
});
