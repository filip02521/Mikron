/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
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
