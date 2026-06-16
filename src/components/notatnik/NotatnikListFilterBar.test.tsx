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

  it("bez bleed nie dodaje ujemnych marginesów", () => {
    const { container } = render(
      <NotatnikListFilterBar
        embedded
        value=""
        onChange={vi.fn()}
        matchCount={0}
        totalCount={3}
      />
    );

    const root = container.firstElementChild;
    expect(root?.className).not.toContain("-mx-3");
  });
});
