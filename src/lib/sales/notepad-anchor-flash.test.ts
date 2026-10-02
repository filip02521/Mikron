/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flashNotepadAnchor, NOTEPAD_FLASH_ATTR } from "./notepad-anchor";

describe("flashNotepadAnchor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("podświetla nakładką (atrybut), której nie zasłoni tło wiersza, i zdejmuje ją po czasie", () => {
    // Wiersz ZK: kontener z kotwicą + wnętrze z własnym nieprzezroczystym tłem.
    document.body.innerHTML = `<article id="watch-1"><div class="bg-white">8236/M/08/2026</div></article>`;
    const onFound = vi.fn();
    flashNotepadAnchor("watch-1", { durationMs: 2000, onFound });
    vi.advanceTimersByTime(120);
    const el = document.getElementById("watch-1")!;
    expect(onFound).toHaveBeenCalled();
    expect(el.hasAttribute(NOTEPAD_FLASH_ATTR)).toBe(true);
    expect(el.style.getPropertyValue("--notepad-flash-ms")).toBe("2000ms");
    // Klasy tła nie są już doklejane do kontenera (były niewidoczne pod bg-white wiersza).
    expect(el.className).toBe("");
    vi.advanceTimersByTime(2000);
    expect(el.hasAttribute(NOTEPAD_FLASH_ATTR)).toBe(false);
  });

  it("czeka, aż wiersz pojawi się w DOM (np. po dodaniu ZK i odświeżeniu listy)", () => {
    flashNotepadAnchor("watch-2");
    vi.advanceTimersByTime(420);
    document.body.innerHTML = `<article id="watch-2"></article>`;
    vi.advanceTimersByTime(120);
    expect(document.getElementById("watch-2")!.hasAttribute(NOTEPAD_FLASH_ATTR)).toBe(true);
  });
});
