/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SupplierPickerField } from "./SupplierPickerField";
import { SCROLL_LOCK_ALLOW_ATTR } from "@/lib/ui/page-scroll-lock";

vi.mock("@/app/actions/subiekt", () => ({
  actionSubiektSuggestSuppliers: vi.fn().mockResolvedValue({ ok: true, suggestions: [] }),
}));

const suppliers = [
  { id: "s1", name: "Alpha Dental" },
  { id: "s2", name: "Beta Lab" },
  { id: "s3", name: "Gamma Supply" },
];

describe("SupplierPickerField", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renderuje listę w portalu (nie przycina w modalu)", () => {
    render(
      <SupplierPickerField suppliers={suppliers} value="" onChange={vi.fn()} allowEmpty={false} />
    );

    fireEvent.focus(screen.getByPlaceholderText("Szukaj dostawcy…"));

    const listbox = screen.getByRole("listbox");
    expect(listbox.parentElement).toBe(document.body);
    expect(listbox.hasAttribute(SCROLL_LOCK_ALLOW_ATTR)).toBe(true);
  });

  it("wybiera dostawcę strzałkami i Enter", () => {
    const onChange = vi.fn();
    render(
      <SupplierPickerField suppliers={suppliers} value="" onChange={onChange} allowEmpty={false} />
    );

    const input = screen.getByPlaceholderText("Szukaj dostawcy…");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("s2");
  });
});
