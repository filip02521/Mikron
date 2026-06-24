/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TypeaheadDropdown } from "./TypeaheadDropdown";
import { SCROLL_LOCK_ALLOW_ATTR } from "@/lib/ui/page-scroll-lock";

describe("TypeaheadDropdown", () => {
  afterEach(() => {
    cleanup();
  });

  it("listbox ma atrybut scroll-lock-allow (przewijanie w modalu)", () => {
    render(
      <TypeaheadDropdown open listboxId="test-list">
        <li>opcja</li>
      </TypeaheadDropdown>
    );

    const listbox = screen.getByRole("listbox");
    expect(listbox.hasAttribute(SCROLL_LOCK_ALLOW_ATTR)).toBe(true);
  });

  it("portalled dropdown ustawia maxHeight i pozycję", () => {
    const anchorRef = { current: document.createElement("div") };
    vi.spyOn(anchorRef.current, "getBoundingClientRect").mockReturnValue({
      top: 400,
      bottom: 440,
      left: 16,
      right: 300,
      width: 284,
      height: 40,
      x: 16,
      y: 400,
      toJSON: () => ({}),
    });

    render(
      <TypeaheadDropdown open portalled anchorRef={anchorRef} size="comfortable" listboxId="portal-list">
        <li>opcja</li>
      </TypeaheadDropdown>
    );

    const listbox = screen.getByRole("listbox");
    expect(listbox.parentElement).toBe(document.body);
    expect(listbox.style.maxHeight).not.toBe("");
    expect(listbox.style.top || listbox.style.bottom).not.toBe("");
  });
});
