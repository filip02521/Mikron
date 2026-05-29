import { describe, expect, it } from "vitest";
import { parseSheetScheduleRow } from "./sheet-schedule-row";

const HEADERS = [
  "DOSTAWCA",
  "KIEROWCA MIKRAN",
  "ZLEC ODBIÓR",
  "SPOSÓB",
  "DODATKOWE",
  "DATA ZAMÓWIENIA",
  "DATA KOLEJNEGO",
  "PRZESUNIĘCIE",
  "ZAPAS",
  "UWAGI URLOPOWE",
];

describe("parseSheetScheduleRow", () => {
  it("czyta G i H osobno — Graphenano z przesunięciem na jutro", () => {
    const row = parseSheetScheduleRow(HEADERS, [
      "Graphenano Dental",
      "",
      "",
      "MAILOWO",
      "",
      "05-05-2026",
      "2026-05-29",
      "2026-05-29",
      "3 MIESIĄCE",
      "",
    ]);
    expect(row?.order_date).toBe("2026-05-05");
    expect(row?.computed_next_date).toBe("2026-05-29");
    expect(row?.shift_date).toBe("2026-05-29");
  });

  it("bez H — tylko DATA KOLEJNEGO, shift_date null", () => {
    const row = parseSheetScheduleRow(HEADERS, [
      "Al Dente",
      "",
      "✔",
      "MAILOWO",
      "",
      "19-05-2026",
      "2026-06-30",
      "",
      "3 MIESIĄCE",
      "",
    ]);
    expect(row?.computed_next_date).toBe("2026-06-30");
    expect(row?.shift_date).toBeNull();
  });

  it("gdy G puste a H ustawione — następna data z przesunięcia", () => {
    const row = parseSheetScheduleRow(HEADERS, [
      "Test",
      "",
      "",
      "MAILOWO",
      "",
      "2026-01-01",
      "",
      "2026-02-15",
      "",
      "",
    ]);
    expect(row?.shift_date).toBe("2026-02-15");
    expect(row?.computed_next_date).toBe("2026-02-15");
  });

  it("kolumna H po indeksie 7 gdy nagłówek bez polskich znaków", () => {
    const headers = [...HEADERS];
    headers[7] = "PRZESUNIECIE";
    const row = parseSheetScheduleRow(headers, [
      "Test",
      "",
      "",
      "MAILOWO",
      "",
      "2026-01-01",
      "2026-02-01",
      "2026-02-15",
      "",
      "",
    ]);
    expect(row?.shift_date).toBe("2026-02-15");
    expect(row?.computed_next_date).toBe("2026-02-01");
  });
});
