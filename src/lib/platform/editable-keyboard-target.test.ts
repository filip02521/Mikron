/** @vitest-environment happy-dom */

import { describe, expect, it } from "vitest";
import { isEditableKeyboardTarget } from "./editable-keyboard-target";

describe("isEditableKeyboardTarget", () => {
  it("rozpoznaje input / textarea / select", () => {
    expect(isEditableKeyboardTarget(document.createElement("input"))).toBe(true);
    expect(isEditableKeyboardTarget(document.createElement("textarea"))).toBe(true);
    expect(isEditableKeyboardTarget(document.createElement("select"))).toBe(true);
  });

  it("rozpoznaje contentEditable", () => {
    const el = document.createElement("div");
    el.contentEditable = "true";
    expect(isEditableKeyboardTarget(el)).toBe(true);
  });

  it("odrzuca zwykłe elementy", () => {
    expect(isEditableKeyboardTarget(document.createElement("button"))).toBe(false);
    expect(isEditableKeyboardTarget(null)).toBe(false);
  });
});
