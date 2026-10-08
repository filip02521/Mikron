import { describe, expect, it } from "vitest";
import { buildTranslatePrompt, looksPolish, parseTranslation } from "./translate-ai";

describe("translate-ai", () => {
  it("looksPolish: polskie słowa albo znaki → true; angielski / niemiecki → false", () => {
    expect(looksPolish("Dzień dobry, proszę o potwierdzenie zamówienia.")).toBe(true);
    expect(looksPolish("Przesyłka już spakowana, wyślemy jutro.")).toBe(true);
    expect(looksPolish("Dear Filip, please find enclosed the invoice for your order.")).toBe(false);
    expect(looksPolish("Sehr geehrte Damen und Herren, die Lieferung erfolgt nächste Woche.")).toBe(false);
  });

  it("prompt zawiera temat i treść między znacznikami, odczyt składa akapity", () => {
    const p = buildTranslatePrompt("Hello,\nprice 12 EUR.", "Re: order 71");
    expect(p).toContain("Temat: Re: order 71");
    expect(p).toContain("<<<MAIL\nHello,\nprice 12 EUR.\nMAIL>>>");
    expect(parseTranslation({ paragraphs: [" Dzień dobry, ", "", "cena 12 EUR."] })).toBe("Dzień dobry,\n\ncena 12 EUR.");
    expect(parseTranslation({ paragraphs: [] })).toBeNull();
  });
});
