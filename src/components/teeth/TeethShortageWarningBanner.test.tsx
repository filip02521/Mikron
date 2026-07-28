/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeethShortageWarningBanner } from "./TeethShortageWarningBanner";
import type { TeethShortageMatchHit } from "@/lib/teeth/teeth-shortage-match";

const hit = (overrides: Partial<TeethShortageMatchHit> = {}): TeethShortageMatchHit => ({
  shortage: {
    id: "s1",
    supplierId: "sup1",
    supplierName: "Lab Test",
    productLine: "wiedent_estetic",
    color: "A1",
    mould: "12",
    kind: "anterior",
    availableFrom: null,
    note: "",
    active: true,
  },
  count: 2,
  color: "A1",
  mould: "12",
  kind: "anterior",
  message: "Brak u Lab Test — termin dostępności nieustalony",
  ...overrides,
});

describe("TeethShortageWarningBanner", () => {
  it("renders undated shortage message without blocking copy", () => {
    render(<TeethShortageWarningBanner hits={[hit()]} />);
    expect(screen.getByText(/Część wybranych zębów jest w braku/i)).toBeTruthy();
    expect(screen.getByText(/termin dostępności nieustalony/i)).toBeTruthy();
    expect(screen.getByText(/Możesz wysłać prośbę mimo braku/i)).toBeTruthy();
  });

  it("shows salesperson note under the hit", () => {
    render(
      <TeethShortageWarningBanner
        compact
        hits={[
          hit({
            shortage: {
              id: "s1",
              supplierId: "sup1",
              supplierName: "Lab Test",
              productLine: "wiedent_estetic",
              color: "A1",
              mould: "12",
              kind: "anterior",
              availableFrom: null,
              note: "Brak surowców u dostawcy",
              active: true,
            },
          }),
        ]}
      />,
    );
    expect(screen.getByText(/Brak surowców u dostawcy/i)).toBeTruthy();
  });

  it("renders nothing when there are no hits", () => {
    const { container } = render(<TeethShortageWarningBanner hits={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
