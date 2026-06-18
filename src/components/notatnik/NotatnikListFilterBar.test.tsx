/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { NotatnikListFilterBar } from "./NotatnikListFilterBar";

describe("NotatnikListFilterBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("stosuje bleed w trybie embedded", () => {
    const { container } = render(
      <NotatnikListFilterBar
        embedded
        bleed
        value=""
        onChange={vi.fn()}
        matchCount={0}
        totalCount={3}
      />
    );

    const root = container.firstElementChild;
    expect(root?.className).toContain("-mx-3");
    expect(root?.className).toContain("sm:-mx-4");
  });

  it("renderuje widoczny nagłówek gdy podano visibleLabel", () => {
    const { getByText } = render(
      <NotatnikListFilterBar
        visibleLabel="Szukaj na swojej liście"
        value=""
        onChange={vi.fn()}
        matchCount={2}
        totalCount={3}
      />
    );

    expect(getByText("Szukaj na swojej liście")).toBeTruthy();
  });
});
