/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installTouchKeyboardAssist, isTypingField, shouldShowTouchKeyboard, TOUCH_FOCUS_WINDOW_MS } from "./touch-keyboard";

describe("shouldShowTouchKeyboard", () => {
  const base = { typingField: true, inTouchZone: true, lastPointerType: "touch", msSinceLastPointer: 200 };
  it("palec albo pióro, niedawno, pole w strefie dotykowej — tak", () => {
    expect(shouldShowTouchKeyboard(base)).toBe(true);
    expect(shouldShowTouchKeyboard({ ...base, lastPointerType: "pen" })).toBe(true);
  });
  it("mysz, dawno, poza strefą albo nie pole tekstowe — nie", () => {
    expect(shouldShowTouchKeyboard({ ...base, lastPointerType: "mouse" })).toBe(false);
    expect(shouldShowTouchKeyboard({ ...base, lastPointerType: null })).toBe(false);
    expect(shouldShowTouchKeyboard({ ...base, msSinceLastPointer: TOUCH_FOCUS_WINDOW_MS + 1 })).toBe(false);
    expect(shouldShowTouchKeyboard({ ...base, inTouchZone: false })).toBe(false);
    expect(shouldShowTouchKeyboard({ ...base, typingField: false })).toBe(false);
  });
});

describe("isTypingField", () => {
  it("tekst, szukanie, liczba i textarea tak; checkbox, tylko do odczytu i wyłączone nie", () => {
    const make = (type: string, extra: { readOnly?: boolean; disabled?: boolean } = {}) => {
      const el = document.createElement("input");
      el.type = type;
      el.readOnly = !!extra.readOnly;
      el.disabled = !!extra.disabled;
      return el;
    };
    expect(isTypingField(make("text"))).toBe(true);
    expect(isTypingField(make("search"))).toBe(true);
    expect(isTypingField(make("number"))).toBe(true);
    expect(isTypingField(document.createElement("textarea"))).toBe(true);
    expect(isTypingField(make("checkbox"))).toBe(false);
    expect(isTypingField(make("text", { readOnly: true }))).toBe(false);
    expect(isTypingField(make("text", { disabled: true }))).toBe(false);
    expect(isTypingField(document.createElement("button"))).toBe(false);
  });
});

describe("installTouchKeyboardAssist", () => {
  const vk = { show: vi.fn(), hide: vi.fn() };
  let cleanup: () => void;
  const pointer = (type: string) => document.dispatchEvent(Object.assign(new Event("pointerdown", { bubbles: true }), { pointerType: type }));

  beforeEach(() => {
    vi.useFakeTimers();
    vk.show.mockReset();
    vk.hide.mockReset();
    Object.defineProperty(navigator, "virtualKeyboard", { value: vk, configurable: true });
    document.body.innerHTML = `<div class="touch-ui"><input id="a" type="text"><input id="b" type="search"><button id="btn">x</button></div><input id="outside" type="text">`;
    cleanup = installTouchKeyboardAssist(document);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("pole z autoFocus po stuknięciu palcem: klawiatura pokazana, polityka manual", () => {
    pointer("touch");
    const a = document.getElementById("a") as HTMLInputElement;
    a.focus();
    expect(vk.show).toHaveBeenCalledTimes(1);
    expect(a.getAttribute("virtualkeyboardpolicy")).toBe("manual");
  });

  it("mysz albo pole poza strefą dotykową: bez klawiatury", () => {
    pointer("mouse");
    (document.getElementById("a") as HTMLInputElement).focus();
    pointer("touch");
    (document.getElementById("outside") as HTMLInputElement).focus();
    expect(vk.show).not.toHaveBeenCalled();
  });

  it("przejście do kolejnego pola nie chowa; wyjście na przycisk chowa", () => {
    pointer("touch");
    (document.getElementById("a") as HTMLInputElement).focus();
    (document.getElementById("b") as HTMLInputElement).focus();
    vi.runAllTimers();
    expect(vk.hide).not.toHaveBeenCalled();
    (document.getElementById("btn") as HTMLButtonElement).focus();
    vi.runAllTimers();
    expect(vk.hide).toHaveBeenCalledTimes(1);
  });

  it("bez VirtualKeyboard API (Firefox, Safari) nic nie robi", () => {
    cleanup();
    Object.defineProperty(navigator, "virtualKeyboard", { value: undefined, configurable: true });
    cleanup = installTouchKeyboardAssist(document);
    pointer("touch");
    (document.getElementById("a") as HTMLInputElement).focus();
    expect(vk.show).not.toHaveBeenCalled();
  });
});
