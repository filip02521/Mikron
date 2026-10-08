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
    const base = { bulk: false, rules, knownCaseThread: false };
    expect(triageOther({ ...base, email: "jan@nowa.example" })).toBe("review");
    expect(triageOther({ ...base, email: "noreply@sklep.example" })).toBeNull();
    expect(triageOther({ ...base, email: "powiadomienia@bank.example" })).toBeNull();
    expect(triageOther({ ...base, email: "jan@nowa.example", bulk: true })).toBeNull();
    expect(triageOther({ ...base, email: "x@reklamy.example" })).toBeNull();
    expect(triageOther({ ...base, email: "anna@agencja.example" })).toBe("case");
  });

  it("kolejna wiadomość w wątku, który już jest sprawą, wchodzi od razu", () => {
    expect(triageOther({ email: "noreply@portal.example", bulk: false, rules, knownCaseThread: true })).toBe("case");
  });

  it("agencje i spedytorzy (także z poddomen i z automatów) idą do odpraw", () => {
    const base = { bulk: false, rules, knownCaseThread: false };
    expect(senderDecision(rules, "jan@pl.spedycja.example")).toBe("customs");
    expect(triageOther({ ...base, email: "noreply@spedycja.example", bulk: true })).toBe("customs");
    expect(triageOther({ ...base, email: "jan@spedycja.example", knownCaseThread: true })).toBe("case");
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
    expect(k("Prośba o tłumaczenie faktury")).toBe("request");
    expect(k("Brakujące dokumenty do odprawy")).toBe("request");
  });
});
