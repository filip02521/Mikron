/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { ZdAutoProposalLine } from "@/lib/data/zd-auto-proposals";
import { ZdProposalFlagsSummary, ZdProposalLineFlags } from "./ZdProposalLineFlags";

afterEach(cleanup);

const line = (flags?: ZdAutoProposalLine["flags"]): ZdAutoProposalLine => ({
  twId: 1,
  symbol: "X-1",
  nazwa: "Towar testowy",
  zdUnits: 1,
  pieces: 1,
  unitLabel: "szt",
  priceNet: 1,
  prosbaPieces: 0,
  floor: false,
  flags,
});

describe("ZdProposalLineFlags", () => {
  it("bez flag nic nie rysuje", () => {
    expect(render(<ZdProposalLineFlags flags={[]} />).container.innerHTML).toBe("");
  });
  it("odznaka na flagę i przycisk z wyjaśnieniem", () => {
    const { container, getByRole } = render(<ZdProposalLineFlags flags={["ceiling", "missing_data"]} />);
    expect(container.textContent).toContain("ponad sufit");
    expect(container.textContent).toContain("brak danych");
    expect(getByRole("button", { name: "Dlaczego do sprawdzenia" })).toBeTruthy();
  });
});

describe("ZdProposalFlagsSummary", () => {
  it("bez flag nic nie rysuje", () => {
    expect(render(<ZdProposalFlagsSummary proposal={{ lines: [line()], flags: [] }} />).container.innerHTML).toBe("");
  });
  it("liczy pozycje z flagą (odmiana) i pokazuje skok wartości ZD", () => {
    const { container } = render(
      <ZdProposalFlagsSummary
        proposal={{ lines: [line(["jump"]), line(), line(["peak", "ceiling"])], flags: ["order_value_jump"] }}
      />
    );
    expect(container.textContent).toContain("2 pozycje do sprawdzenia");
    expect(container.textContent).toContain("Wartość ZD ponad 2× większa niż zwykle");
  });
  it("sam skok wartości bez flag linii", () => {
    const { container } = render(<ZdProposalFlagsSummary proposal={{ lines: [line()], flags: ["order_value_jump"] }} />);
    expect(container.textContent).not.toContain("do sprawdzenia -");
    expect(container.textContent).toContain("Wartość ZD");
  });
});
