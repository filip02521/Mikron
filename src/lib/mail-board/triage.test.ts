import { describe, expect, it } from "vitest";
import { customsMailKind, rulePattern, senderDecision, triageOther, type SenderRule } from "./triage";

const rules: SenderRule[] = [
  { pattern: "@agencja.example", decision: "case" },
  { pattern: "spam@agencja.example", decision: "ignore" },
  { pattern: "@reklamy.example", decision: "ignore" },
  { pattern: "@spedycja.example", decision: "customs" },
];

describe("sita skrzynki", () => {
  it("adres wygrywa z domeną", () => {
    expect(senderDecision(rules, "Anna@Agencja.example")).toBe("case");
    expect(senderDecision(rules, "spam@agencja.example")).toBe("ignore");
    expect(senderDecision(rules, "x@inna.example")).toBeNull();
  });

  it("reguła domeny tylko dla domen firmowych", () => {
    expect(rulePattern("jan@firma.example", "domain")).toBe("@firma.example");
    expect(rulePattern("jan@gmail.com", "domain")).toBeNull();
    expect(rulePattern("Jan@Gmail.com", "sender")).toBe("jan@gmail.com");
  });

  it("nieznany człowiek → do przejrzenia, automat i ignorowany → pominięty", () => {
    const base = { bulk: false, rules, threadDecision: null };
    expect(triageOther({ ...base, email: "jan@nowa.example" })).toBe("review");
    expect(triageOther({ ...base, email: "noreply@sklep.example" })).toBeNull();
    expect(triageOther({ ...base, email: "powiadomienia@bank.example" })).toBeNull();
    expect(triageOther({ ...base, email: "jan@nowa.example", bulk: true })).toBeNull();
    expect(triageOther({ ...base, email: "x@reklamy.example" })).toBeNull();
    expect(triageOther({ ...base, email: "anna@agencja.example" })).toBe("case");
  });

  it("kolejna wiadomość w rozstrzygniętym wątku idzie jak wątek", () => {
    const base = { bulk: false, rules };
    expect(triageOther({ ...base, email: "noreply@portal.example", threadDecision: "case" })).toBe("case");
    expect(triageOther({ ...base, email: "jan@nowa.example", threadDecision: "customs" })).toBe("customs");
    expect(triageOther({ ...base, email: "anna@agencja.example", threadDecision: "ignored" })).toBeNull();
  });

  it("agencje i spedytorzy (także z poddomen i z automatów) idą do odpraw", () => {
    const base = { bulk: false, rules, threadDecision: null };
    expect(senderDecision(rules, "jan@pl.spedycja.example")).toBe("customs");
    expect(triageOther({ ...base, email: "noreply@spedycja.example", bulk: true })).toBe("customs");
    expect(triageOther({ ...base, email: "jan@spedycja.example", threadDecision: "case" })).toBe("case");
  });

  it("rodzaj maila agencji", () => {
    const k = (subject: string, files: string[] = []) => customsMailKind({ subject, attachmentNames: files });
    expect(k("Powiadomienie o należnościach - AWB 123")).toBe("dues");
    expect(k("Wykaz należności do zapłaty")).toBe("dues");
    expect(k("Faktura FV/123/10/2026")).toBe("documents");
    expect(k("RE: zgłoszenie", ["SAD_ZC429.pdf"])).toBe("documents");
    expect(k("RE: Prośba o wycenę - Fastform")).toBe("quote");
    expect(k("RE: Zlecenie odbioru towaru Ernst Hinrichs")).toBe("pickup");
    expect(k("RE: pytanie o transport Tajwan-Polska")).toBe("quote");
    // Ostatnia wiadomość mówi, co teraz: dane kierowcy → awizacja, prośba o dokumenty → odpowiedz.
    expect(customsMailKind({ subject: "RE: pytanie o transport Tajwan-Polska", attachmentNames: [], snippet: "Podsyłam dane kierowcy" })).toBe("pickup");
    expect(customsMailKind({ subject: "RE: Oferta", attachmentNames: [], snippet: "Prosimy o przesłanie faktury handlowej" })).toBe("request");
    expect(k("Prośba o tłumaczenie faktury")).toBe("request");
    expect(k("Brakujące dokumenty do odprawy")).toBe("request");
  });
});
