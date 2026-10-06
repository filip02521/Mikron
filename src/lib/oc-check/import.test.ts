import { describe, expect, it } from "vitest";
import { parseOcImport } from "./import";

const polirapid = {
  gmail_thread_id: "1a10bd3a47bb83e6",
  gmail_message_id: "1a10bd3a47bb83e6",
  mailbox: "Filip.Naskret@mikran.com",
  supplier_name: "Polirapid",
  zd_number: "3/M/10/2026",
  oc_number: "2027-20320",
  oc_received_at: "2026-10-05T11:29:28Z",
  status: "rozbieznosci",
  priority: 2,
  summary: "5 pozycji potraktowanych jak opakowania",
  next_step: "Zdecyduj o pełnych opakowaniach",
  lines_total: 22,
  lines_ok: 17,
  lines: [
    { position: 1, symbol: "MBH 11 309", qty_ordered: 1, qty_confirmed: "100", unit_ordered: "szt.", unit_confirmed: "Pcs", kind: "jednostka" },
  ],
};

describe("parseOcImport", () => {
  it("przyjmuje obiekt { checks } i normalizuje pola", () => {
    const result = parseOcImport(JSON.stringify({ checks: [polirapid] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [check] = result.checks;
    expect(check?.source_key).toBe("gmail:1a10bd3a47bb83e6");
    expect(check?.mailbox).toBe("filip.naskret@mikran.com");
    expect(check?.priority).toBe(2);
    expect(check?.lines[0]?.qty_confirmed).toBe(100);
    expect(check?.oc_received_at).toBe("2026-10-05T11:29:28.000Z");
  });

  it("przyjmuje samą tablicę", () => {
    expect(parseOcImport(JSON.stringify([polirapid])).ok).toBe(true);
  });

  it("odrzuca nieznany status i rodzaj pozycji", () => {
    expect(parseOcImport(JSON.stringify([{ ...polirapid, status: "ok" }]))).toEqual({
      ok: false,
      error: "sprawa 1: nieznany status „ok”",
    });
    const badLine = { ...polirapid, lines: [{ position: 1, kind: "inne" }] };
    expect(parseOcImport(JSON.stringify([badLine])).ok).toBe(false);
  });

  it("odrzuca sprawę bez klucza, bez dostawcy i z duplikatem", () => {
    const noKey = { ...polirapid, gmail_thread_id: null, gmail_message_id: "x" };
    expect(parseOcImport(JSON.stringify([noKey])).ok).toBe(false);
    expect(parseOcImport(JSON.stringify([{ ...polirapid, supplier_name: " " }])).ok).toBe(false);
    expect(parseOcImport(JSON.stringify([polirapid, polirapid])).ok).toBe(false);
  });

  it("odrzuca niespójne liczniki pozycji i powtórzone pozycje", () => {
    expect(parseOcImport(JSON.stringify([{ ...polirapid, lines_ok: 30 }])).ok).toBe(false);
    const dup = { ...polirapid, lines: [{ position: 1, kind: "ok" }, { position: 1, kind: "ok" }] };
    expect(parseOcImport(JSON.stringify([dup])).ok).toBe(false);
  });

  it("odrzuca nie-JSON i pustą listę", () => {
    expect(parseOcImport("nie json").ok).toBe(false);
    expect(parseOcImport("[]").ok).toBe(false);
  });

  it("nieprawidłowa data dostawy i priorytet spoza zakresu nie psują importu", () => {
    const loose = { ...polirapid, priority: 7, lines: [{ position: 1, kind: "termin", delivery_date: "05.10.2026" }] };
    const result = parseOcImport(JSON.stringify([loose]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.checks[0]?.priority).toBe(0);
    expect(result.checks[0]?.lines[0]?.delivery_date).toBeNull();
  });
});
