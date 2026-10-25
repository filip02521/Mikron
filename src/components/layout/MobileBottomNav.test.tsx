/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/podsumowanie",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

import { MobileOperationsNav } from "./MobileOperationsNav";
import { MobileSalesNav } from "./MobileSalesNav";

/** Każda pozycja paska (także „Więcej”) ma ten sam kafel 28px — inaczej etykiety stoją na różnej wysokości. */
function expectEveryItemHasTile(nav: HTMLElement) {
  const items = [...nav.querySelectorAll(":scope > ul > li > a, :scope > ul > li > button")];
  expect(items.length).toBeGreaterThanOrEqual(2);
  for (const item of items) {
    expect(item.querySelector("span.h-7.w-7"), item.textContent ?? "").not.toBeNull();
  }
  expect(items.some((item) => item.textContent?.includes("Więcej"))).toBe(true);
}

describe("dolny pasek telefonu", () => {
  afterEach(cleanup);

  it("zakupy: pozycje i „Więcej” mają ten sam kafel ikony", () => {
    render(<MobileOperationsNav role="admin" />);
    expectEveryItemHasTile(screen.getByRole("navigation"));
  });

  it("handlowiec: pozycje i „Więcej” mają ten sam kafel ikony", () => {
    render(<MobileSalesNav role="sales" />);
    expectEveryItemHasTile(screen.getByRole("navigation"));
  });
});
