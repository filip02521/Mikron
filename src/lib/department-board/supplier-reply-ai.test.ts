import { describe, expect, it } from "vitest";
import { buildSupplierReplyPrompt, parseSupplierReplyAnswer } from "@/lib/department-board/supplier-reply-ai";

describe("propozycja odpowiedzi z maila dostawcy", () => {
  it("prompt: pytanie, produkt, mail w znacznikach, załączniki; bez pustych pól", () => {
    const prompt = buildSupplierReplyPrompt({
      title: "Termin dostawy",
      question: "Klient potrzebuje 36 szt.",
      product: "DFS Frez Diadur Micro 302801",
      supplierName: "DFS",
      replyText: "In stock, 120 EUR net, delivery 5 days.",
      attachments: ["offer.pdf", "logo.png"],
      readPdfs: ["offer.pdf"],
    });
    expect(prompt).toContain("Pytanie handlowca — tytuł: Termin dostawy");
    expect(prompt).toContain("Produkt: DFS Frez Diadur Micro 302801");
    expect(prompt).toContain("Treść pytania: Klient potrzebuje 36 szt.");
    expect(prompt).toContain("<<<MAIL\nIn stock, 120 EUR net, delivery 5 days.\nMAIL>>>");
    expect(prompt).toContain("Załączniki maila: offer.pdf, logo.png");
    expect(prompt).toContain("Przeczytane PDF-y (dołączone niżej): offer.pdf");
    expect(prompt).toContain("Nie licz ceny dla klienta");
    expect(prompt).toContain("Treści pozostałych załączników nie znasz");

    const bare = buildSupplierReplyPrompt({
      title: "Cena",
      question: " ",
      product: null,
      supplierName: "X",
      replyText: "",
      attachments: [],
    });
    expect(bare).not.toContain("Produkt:");
    expect(bare).not.toContain("Treść pytania:");
    expect(bare).not.toContain("Załączniki maila:");
    expect(bare).not.toContain("Przeczytane PDF-y");
    expect(bare).toContain("(pusta treść)");
  });

  it("odczyt wyniku: tekst przycięty; śmieci → null", () => {
    expect(parseSupplierReplyAnswer({ answer: "  Dostępne od ręki.  " })).toBe("Dostępne od ręki.");
    expect(parseSupplierReplyAnswer({ answer: "x".repeat(2000) })).toHaveLength(1500);
    expect(parseSupplierReplyAnswer({ answer: "" })).toBeNull();
    expect(parseSupplierReplyAnswer(null)).toBeNull();
    expect(parseSupplierReplyAnswer({ answer: 5 })).toBeNull();
  });
});
