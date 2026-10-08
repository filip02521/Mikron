import { describe, expect, it } from "vitest";
import { rulePattern, senderDecision, triageOther, type SenderRule } from "./triage";

const rules: SenderRule[] = [
  { pattern: "@agencja.example", decision: "case" },
  { pattern: "spam@agencja.example", decision: "ignore" },
  { pattern: "@reklamy.example", decision: "ignore" },
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
});
