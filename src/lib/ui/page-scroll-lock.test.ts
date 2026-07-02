/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  lockPageScroll,
  runAfterScrollUnlock,
  unlockPageScroll,
} from "./page-scroll-lock";

function setupMain() {
  const main = document.createElement("main");
  main.className = "overflow-y-auto";
  main.scrollTop = 120;
  document.body.appendChild(main);
  return main;
}

afterEach(() => {
  for (let i = 0; i < 8; i += 1) unlockPageScroll();
  document.documentElement.classList.remove("ontime-scroll-locked");
  document.body.classList.remove("ontime-scroll-locked");
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
  document.body.innerHTML = "";
});

describe("page-scroll-lock", () => {
  it("blokuje scroll na html, body i main", () => {
    const main = setupMain();
    lockPageScroll();

    expect(document.documentElement.classList.contains("ontime-scroll-locked")).toBe(true);
    expect(document.body.classList.contains("ontime-scroll-locked")).toBe(true);
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");
    expect(main.style.overflow).toBe("hidden");

    unlockPageScroll();

    expect(document.documentElement.classList.contains("ontime-scroll-locked")).toBe(false);
    expect(main.style.overflow).toBe("");
    expect(main.scrollTop).toBe(120);
  });

  it("obsługuje zagnieżdżone blokady (licznik referencji)", () => {
    setupMain();
    lockPageScroll();
    lockPageScroll();

    expect(document.documentElement.classList.contains("ontime-scroll-locked")).toBe(true);

    unlockPageScroll();
    expect(document.documentElement.classList.contains("ontime-scroll-locked")).toBe(true);

    unlockPageScroll();
    expect(document.documentElement.classList.contains("ontime-scroll-locked")).toBe(false);
  });

  it("runAfterScrollUnlock uruchamia callback po odblokowaniu main", async () => {
    vi.useFakeTimers();
    setupMain();
    lockPageScroll();

    const fn = vi.fn();
    runAfterScrollUnlock(fn);

    unlockPageScroll();
    expect(fn).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();
    expect(fn).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
