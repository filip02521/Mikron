import { describe, expect, it } from "vitest";
import {
  normalizeZdNumberKey,
  pickZdCandidateFromSearch,
  validateZdQueryForSubmit,
  zdNumbersEquivalent,
  zdReceiveSearchChooseHint,
  sortZdReceiveCandidatesByIssuedAtDesc,
  formatZdDocNumberLabel,
  isFullZdNumberQuery,
  isPartialZdNumberQuery,
  zdReceiveSearchMonthsBack,
  ZD_RECEIVE_PARTIAL_SEARCH_MONTHS,
  ZD_RECEIVE_FULL_SEARCH_MONTHS,
} from "./zd-document";

describe("zd-document", () => {
  it("normalizuje prefiks ZD", () => {
    expect(normalizeZdNumberKey("ZD/123/2026")).toBe("123/2026");
    expect(normalizeZdNumberKey("zd 123/2026")).toBe("123/2026");
    expect(zdNumbersEquivalent("ZD/123/2026", "123/2026")).toBe(true);
  });

  it("waliduje wpis przed wyszukiwaniem", () => {
    expect(validateZdQueryForSubmit("")).toEqual({
      ok: false,
      message: "Podaj numer ZD, np. ZD/123/2026.",
    });
    expect(validateZdQueryForSubmit("Z")).toEqual({
      ok: false,
      message: "Wpisz co najmniej 2 znaki numeru ZD.",
    });
    expect(validateZdQueryForSubmit("ZD/123/2026")).toEqual({
      ok: true,
      normalized: "123/2026",
    });
  });

  it("wybiera jednoznacznego kandydata", () => {
    const candidates = [
      { dokId: 1, docNumber: "ZD/123/2026" },
      { dokId: 2, docNumber: "ZD/124/2026" },
    ];
    expect(pickZdCandidateFromSearch("ZD/123/2026", candidates)?.dokId).toBe(1);
    expect(pickZdCandidateFromSearch("123", candidates)).toBeNull();
  });

  it("formatuje etykietę numeru ZD bez prefiksu", () => {
    expect(formatZdDocNumberLabel("ZD/123/2026")).toBe("123/2026");
    expect(formatZdDocNumberLabel("zd 81/2026")).toBe("81/2026");
  });

  it("rozróżnia pełny i krótki numer ZD", () => {
    expect(isFullZdNumberQuery("ZD/123/2026")).toBe(true);
    expect(isFullZdNumberQuery("123/2026")).toBe(true);
    expect(isPartialZdNumberQuery("81")).toBe(true);
    expect(isPartialZdNumberQuery("123/2026")).toBe(false);
  });

  it("ustala zakres dat wyszukiwania ZD w kolejce przyjęcia", () => {
    expect(zdReceiveSearchMonthsBack("81")).toBe(ZD_RECEIVE_PARTIAL_SEARCH_MONTHS);
    expect(zdReceiveSearchMonthsBack("123/2026")).toBe(ZD_RECEIVE_FULL_SEARCH_MONTHS);
  });

  it("buduje podpowiedź wyboru z listy", () => {
    expect(zdReceiveSearchChooseHint("81", 3)).toContain("81");
    expect(zdReceiveSearchChooseHint("81", 3)).toContain("3");
    expect(zdReceiveSearchChooseHint("81", 1)).toContain("jednego");
  });

  it("sortuje kandydatów ZD od najświeższych", () => {
    const sorted = sortZdReceiveCandidatesByIssuedAtDesc([
      {
        dokId: 1,
        docNumber: "ZD/10/2025",
        supplierLabel: "A",
        issuedAt: "2025-01-10",
      },
      {
        dokId: 2,
        docNumber: "ZD/81/2026",
        supplierLabel: "B",
        issuedAt: "2026-03-15",
      },
      {
        dokId: 3,
        docNumber: "ZD/81/2026",
        supplierLabel: "C",
        issuedAt: "2026-01-02",
      },
    ]);
    expect(sorted.map((item) => item.dokId)).toEqual([2, 3, 1]);
  });
});
