import { describe, expect, it } from "vitest";
import { convertEmoticonAtCaret, convertEmoticons } from "./emoticons";

describe("convertEmoticons", () => {
  it("buźki z granicą słowa; adresy, godziny i środek słowa zostają", () => {
    expect(convertEmoticons("Dzięki :) do jutra ;-) <3")).toBe("Dzięki 🙂 do jutra 😉 ❤️");
    expect(convertEmoticons("ok:)")).toBe("ok:)");
    expect(convertEmoticons("http://sklep.pl o 10:30 :D")).toBe("http://sklep.pl o 10:30 😀");
    expect(convertEmoticons("(:P)")).toBe("(😛)");
    expect(convertEmoticons(":)")).toBe("🙂");
  });
});

describe("convertEmoticonAtCaret", () => {
  it("zamienia buźkę tuż przed wpisaną spacją i przesuwa kursor", () => {
    const r = convertEmoticonAtCaret("Dzięki :-) ", 11);
    expect(r).toEqual({ value: "Dzięki 🙂 ", caret: 10 });
  });

  it("bez spacji po buźce nic nie zmienia (można dopisać „:))”), w środku słowa też nie", () => {
    expect(convertEmoticonAtCaret("Dzięki :)", 9)).toBeNull();
    expect(convertEmoticonAtCaret("ok:) ", 5)).toBeNull();
  });
});
