import { describe, expect, it } from "vitest";
import type { AutoProsbaBlockedCode } from "./zk-watch-auto-prosba";
import {
  buildAutoProsbaClientBlockedToast,
  buildAutoProsbaSuccessToast,
  formatAddedPozycjeCount,
  formatAutoProsbaSkippedLinesMessage,
  formatAutoProsbaStockConfirmSummary,
  formatZkScopeSavedToast,
  mapZkQuantityConfirmLabelForAuto,
  mapZkQuantityConfirmMessageForAuto,
  normalizeAutoProsbaToastAfterScopeSaved,
  nextAutoProsbaAckAfterConfirm,
  shouldPassThroughAutoProsbaToastAfterScope,
  toastForAutoProsbaBlockedCode,
  toastForAutoProsbaDialogCancelled,
  toastForScopeSavedOnly,
  toastForScopeSavedProsbaFailed,
  toastForTeethSkippedAfterScope,
} from "./zk-watch-auto-prosba-copy";
import type { SalesZkWatch } from "@/types/database";

const watch = {
  id: "w1",
  sales_person_id: "sp1",
  client_label: "Klinika Smile",
  client_kh_id: 1,
  zk_number: "ZK/2026/0138",
} as SalesZkWatch;

const BLOCKED_CODES: AutoProsbaBlockedCode[] = [
  "redirect_open_prosba",
  "skipped_already_covered",
  "blocked_teeth_incomplete",
  "blocked_teeth_catalog",
  "blocked_no_lines",
  "blocked_no_scope",
  "blocked_watch_closed",
  "blocked_unauthorized",
  "blocked_batch_lock",
  "blocked_batch_size",
  "error_stock_ack_required",
  "error_generic",
];

describe("formatAddedPozycjeCount", () => {
  it("odmienia biernik po „Dodano”", () => {
    expect(formatAddedPozycjeCount(1)).toBe("Dodano 1 pozycję");
    expect(formatAddedPozycjeCount(2)).toBe("Dodano 2 pozycje");
    expect(formatAddedPozycjeCount(3)).toBe("Dodano 3 pozycje");
    expect(formatAddedPozycjeCount(5)).toBe("Dodano 5 pozycji");
    expect(formatAddedPozycjeCount(12)).toBe("Dodano 12 pozycji");
    expect(formatAddedPozycjeCount(22)).toBe("Dodano 22 pozycje");
  });
});

describe("formatZkScopeSavedToast", () => {
  it("N=1 bez plPozycja", () => {
    expect(formatZkScopeSavedToast(1)).toBe("Zapisano zakres — 1 pozycja do zamówienia.");
  });

  it("N>1 z plPozycja", () => {
    expect(formatZkScopeSavedToast(3)).toBe("Zapisano zakres — 3 pozycje do zamówienia.");
    expect(formatZkScopeSavedToast(5)).toBe("Zapisano zakres — 5 pozycji do zamówienia.");
  });
});

describe("formatAutoProsbaSkippedLinesMessage", () => {
  it("M z N z odmianą pominiętych", () => {
    expect(
      formatAutoProsbaSkippedLinesMessage({ effectiveCount: 2, selectedCount: 3 })
    ).toBe(
      "Dodano 2 z 3 zaznaczonych pozycji — 1 pozycja jest już w prośbie lub czeka na informację o dostępności."
    );
  });

  it("wiele pominiętych — liczba mnoga", () => {
    expect(
      formatAutoProsbaSkippedLinesMessage({ effectiveCount: 1, selectedCount: 4 })
    ).toContain("3 pozycje są już w prośbie");
  });
});

describe("toastForAutoProsbaBlockedCode", () => {
  it.each(BLOCKED_CODES)("code %s ma title, message i tone", (code) => {
    const toast = toastForAutoProsbaBlockedCode(code);
    expect(toast.code).toBe(code);
    expect(toast.title.trim().length).toBeGreaterThan(0);
    expect(toast.message.trim().length).toBeGreaterThan(0);
    expect(["success", "warning", "error"]).toContain(toast.tone);
  });

  it("redirect_open_prosba — actionLabel Otwórz prośbę", () => {
    expect(toastForAutoProsbaBlockedCode("redirect_open_prosba").actionLabel).toBe(
      "Otwórz prośbę"
    );
  });

  it("skipped_already_covered — actionLabel Prośby tego klienta", () => {
    expect(toastForAutoProsbaBlockedCode("skipped_already_covered").actionLabel).toBe(
      "Prośby tego klienta"
    );
  });

  it("error_generic — dokleja detail przed zakresem", () => {
    const toast = toastForAutoProsbaBlockedCode("error_generic", "Błąd sieci.");
    expect(toast.message).toContain("Błąd sieci.");
    expect(toast.message).toContain("Zakres pozostaje zapisany");
  });
});

describe("toastForScopeSavedOnly", () => {
  it("sukces bez linku", () => {
    const toast = toastForScopeSavedOnly(2);
    expect(toast.title).toBe("Zakres zapisany");
    expect(toast.tone).toBe("success");
    expect(toast.message).toContain("2 pozycje do zamówienia");
    expect(toast.actionHref).toBeUndefined();
  });
});

describe("toastForAutoProsbaDialogCancelled", () => {
  it("warning po anulowaniu dialogu", () => {
    const toast = toastForAutoProsbaDialogCancelled();
    expect(toast.title).toBe("Zakres zapisany");
    expect(toast.tone).toBe("warning");
    expect(toast.message).toContain("Prośba nie powstała");
  });
});

describe("toastForTeethSkippedAfterScope", () => {
  it("warning po pominięciu zębów", () => {
    const toast = toastForTeethSkippedAfterScope();
    expect(toast.title).toBe("Zakres zapisany");
    expect(toast.message).toContain("listę zębów");
  });
});

describe("toastForScopeSavedProsbaFailed", () => {
  it("usuwa duplikat „Zakres pozostaje zapisany”", () => {
    const toast = toastForScopeSavedProsbaFailed(
      "Błąd sieci. Zakres pozostaje zapisany — spróbuj ponownie z karty ZK."
    );
    expect(toast.title).toBe("Zakres zapisany");
    expect(toast.message).toContain("Błąd sieci");
    expect(toast.message).not.toContain("Zakres pozostaje zapisany");
    expect(toast.message).toContain("Możesz dodać ją z karty ZK");
  });
});

describe("buildAutoProsbaSuccessToast", () => {
  const base = {
    watch,
    count: 2,
    complete: 2,
    verification: 0,
    effectiveLineCount: 2,
    actionHref: "/moje?client=1",
  };

  it("created — tytuł Prośba zapisana", () => {
    const toast = buildAutoProsbaSuccessToast({ ...base, code: "created" });
    expect(toast.title).toBe("Prośba zapisana");
    expect(toast.message).toContain("Moje zamówienia");
    expect(toast.message).toContain("Powiązano z");
    expect(toast.actionLabel).toBe("Prośby tego klienta");
  });

  it("created_supplement — istniejąca prośba", () => {
    const toast = buildAutoProsbaSuccessToast({ ...base, code: "created_supplement", count: 1 });
    expect(toast.message).toContain("do istniejącej prośby dla Klinika Smile");
  });

  it("created_partial_verification — formatSubmitResult", () => {
    const toast = buildAutoProsbaSuccessToast({
      ...base,
      code: "created_partial_verification",
      complete: 1,
      verification: 1,
      count: 2,
    });
    expect(toast.message).toContain("weryfikacji");
  });

  it("created_with_skipped_lines — M z N", () => {
    const toast = buildAutoProsbaSuccessToast({
      ...base,
      code: "created_with_skipped_lines",
      complete: 2,
      verification: 0,
      selectedScopeCount: 3,
    });
    expect(toast.message).toContain("Dodano 2 z 3 zaznaczonych pozycji");
  });

  it("dopisek notatki sprawy", () => {
    const toast = buildAutoProsbaSuccessToast({
      ...base,
      code: "created",
      includeCaseNote: true,
    });
    expect(toast.message).toContain("Notatka sprawy trafiła do uwag pozycji");
  });
});

describe("mapZkQuantityConfirmLabelForAuto", () => {
  it("podmienia wyślij → utwórz prośbę", () => {
    expect(mapZkQuantityConfirmLabelForAuto("Tak, wyślij prośbę")).toBe("Tak, utwórz prośbę");
    expect(mapZkQuantityConfirmLabelForAuto("Potwierdzam i wysyłam")).toBe(
      "Potwierdzam i tworzę prośbę"
    );
    expect(mapZkQuantityConfirmLabelForAuto("Wyślij mimo różnicy")).toBe(
      "Utwórz prośbę mimo różnicy"
    );
  });
});

describe("mapZkQuantityConfirmMessageForAuto", () => {
  it("podmienia czasowniki wysyłki w treści dialogu", () => {
    expect(
      mapZkQuantityConfirmMessageForAuto("Czy potwierdzasz podział i wysyłasz prośbę?")
    ).toBe("Czy potwierdzasz podział i tworzysz prośbę?");
    expect(
      mapZkQuantityConfirmMessageForAuto("Czy na pewno chcesz złożyć prośbę na taką ilość?")
    ).toBe("Czy na pewno chcesz utworzyć prośbę na taką ilość?");
  });
});

describe("formatAutoProsbaStockConfirmSummary", () => {
  it("odmienia pozycje", () => {
    expect(formatAutoProsbaStockConfirmSummary(1)).toContain("1 pozycja");
    expect(formatAutoProsbaStockConfirmSummary(2)).toContain("2 pozycje");
    expect(formatAutoProsbaStockConfirmSummary(5)).toContain("5 pozycji");
  });
});

describe("shouldPassThroughAutoProsbaToastAfterScopeSaved", () => {
  it("przepuszcza tylko sukces", () => {
    expect(
      shouldPassThroughAutoProsbaToastAfterScope({ tone: "success", code: "created" })
    ).toBe(true);
    expect(
      shouldPassThroughAutoProsbaToastAfterScope({
        tone: "warning",
        code: "redirect_open_prosba",
      })
    ).toBe(false);
    expect(
      shouldPassThroughAutoProsbaToastAfterScope({
        tone: "warning",
        code: "skipped_already_covered",
      })
    ).toBe(false);
  });

  it("opakowuje błędy", () => {
    expect(
      shouldPassThroughAutoProsbaToastAfterScope({
        tone: "error",
        code: "error_generic",
      })
    ).toBe(false);
  });
});

describe("normalizeAutoProsbaToastAfterScopeSaved", () => {
  it("redirect/skipped — kontekst zapisanego zakresu", () => {
    const normalized = normalizeAutoProsbaToastAfterScopeSaved(
      toastForAutoProsbaBlockedCode("redirect_open_prosba"),
      { selectedScopeCount: 2 }
    );
    expect(normalized.title).toBe("Zakres zapisany");
    expect(normalized.message).toContain("Zapisano zakres — 2 pozycje");
    expect(normalized.message).toContain("już w otwartej prośbie");
  });
  it("blocked_teeth_incomplete → toast zębów", () => {
    const normalized = normalizeAutoProsbaToastAfterScopeSaved(
      toastForAutoProsbaBlockedCode("blocked_teeth_incomplete")
    );
    expect(normalized.title).toBe("Zakres zapisany");
    expect(normalized.message).toContain("listę zębów");
  });

  it("error_stock_ack_required — przekazuje szczegóły serwera", () => {
    const serverDetail =
      "Część pozycji ma wystarczający stan magazynowy w Subiekcie:\n\n• Filtr — 2 szt.";
    const toast = toastForAutoProsbaBlockedCode("error_stock_ack_required", serverDetail);
    expect(toast.message).toContain("Filtr");

    const normalized = normalizeAutoProsbaToastAfterScopeSaved(toast);
    expect(normalized.title).toBe("Zakres zapisany");
    expect(normalized.message).toContain("Prośba nie powstała");
    expect(normalized.message).toContain("Filtr");
  });

  it("skipped_already_covered — kontekst zakresu z liczbą pozycji", () => {
    const normalized = normalizeAutoProsbaToastAfterScopeSaved(
      toastForAutoProsbaBlockedCode("skipped_already_covered"),
      { selectedScopeCount: 4 }
    );
    expect(normalized.title).toBe("Zakres zapisany");
    expect(normalized.message).toContain("4 pozycje");
    expect(normalized.message).toContain("pokryte prośbą");
  });

  it("sukces created — bez zmian", () => {
    const success = buildAutoProsbaSuccessToast({
      watch,
      code: "created",
      count: 2,
      complete: 2,
      verification: 0,
      effectiveLineCount: 2,
      actionHref: "/moje",
    });
    expect(normalizeAutoProsbaToastAfterScopeSaved(success)).toBe(success);
  });

  it("error_generic → złożony toast", () => {
    const normalized = normalizeAutoProsbaToastAfterScopeSaved(
      toastForAutoProsbaBlockedCode("error_stock_ack_required")
    );
    expect(normalized.title).toBe("Zakres zapisany");
    expect(normalized.message).toContain("Prośba nie powstała");
  });
});

describe("buildAutoProsbaClientBlockedToast", () => {
  const mojeHref = "/moje?client=1";
  const mojeHrefWithFocus = (ids: string[]) => `/moje?focus=${ids.join(",")}`;

  it("redirect — link z focusem", () => {
    const toast = buildAutoProsbaClientBlockedToast({
      watch,
      hints: { matchingOpenRequestIds: ["o1", "o2"] },
      blocked: "redirect_open_prosba",
      mojeHref,
      mojeHrefWithFocus,
    });
    expect(toast.code).toBe("redirect_open_prosba");
    expect(toast.actionHref).toBe("/moje?focus=o1,o2");
  });

  it("skipped — link bez focus", () => {
    const toast = buildAutoProsbaClientBlockedToast({
      watch,
      hints: { matchingOpenRequestIds: [] },
      blocked: "skipped_already_covered",
      mojeHref,
      mojeHrefWithFocus,
    });
    expect(toast.actionHref).toBe(mojeHref);
  });

  it("teeth_incomplete — dedykowany toast", () => {
    const toast = buildAutoProsbaClientBlockedToast({
      watch,
      hints: { matchingOpenRequestIds: [] },
      blocked: "teeth_incomplete",
      mojeHref,
      mojeHrefWithFocus,
    });
    expect(toast.title).toBe("Zakres zapisany");
    expect(toast.code).toBe("blocked_teeth_incomplete");
  });
});

describe("nextAutoProsbaAckAfterConfirm", () => {
  it("stock ustawia acknowledgeSufficientStock", () => {
    expect(nextAutoProsbaAckAfterConfirm("stock", {})).toEqual({
      acknowledgeSufficientStock: true,
    });
  });

  it("zk_quantity zachowuje stock ack", () => {
    expect(
      nextAutoProsbaAckAfterConfirm("zk_quantity", { acknowledgeSufficientStock: true })
    ).toEqual({
      acknowledgeSufficientStock: true,
      acknowledgeZkQuantityMismatch: true,
    });
  });
});
