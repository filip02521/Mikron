// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { isTextSelectionInside } from "@/lib/ui/panel-row-actions-reveal";

describe("isTextSelectionInside", () => {
  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    document.body.innerHTML = "";
  });

  function setup() {
    document.body.innerHTML = '<div id="row"><span id="sym">ABC-123</span></div><p id="out">poza</p>';
    return document.getElementById("row")!;
  }

  function select(id: string) {
    const range = document.createRange();
    range.selectNodeContents(document.getElementById(id)!);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
  }

  it("zwykły klik bez zaznaczenia przełącza wiersz", () => {
    expect(isTextSelectionInside(setup())).toBe(false);
  });

  it("zaznaczony symbol w wierszu blokuje przełączenie", () => {
    const row = setup();
    select("sym");
    expect(isTextSelectionInside(row)).toBe(true);
  });

  it("zaznaczenie poza wierszem nie blokuje", () => {
    const row = setup();
    select("out");
    expect(isTextSelectionInside(row)).toBe(false);
  });
});
