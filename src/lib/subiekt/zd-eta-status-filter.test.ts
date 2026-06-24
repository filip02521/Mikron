import { describe, expect, it } from "vitest";
import { findBestMatchingZdDocument } from "@/lib/subiekt/match-order-to-zd";
import type { IndividualOrder } from "@/types/database";
import type { SubiektDocument } from "@/lib/subiekt/types";
import {
  isActiveZdFulfillmentDocument,
  isFulfilledZdDocumentStatus,
  isZdEtaOpenDocumentStatus,
  shouldSkipZdListItemForEta,
  ZD_DOCUMENT_STATUS_FULFILLED,
  ZD_DOCUMENT_STATUS_UNREALIZED,
  ZD_DOCUMENT_STATUS_UNREALIZED_NO_RESERVATION,
  ZD_DOCUMENT_STATUS_UNREALIZED_WITH_RESERVATION,
} from "@/lib/subiekt/zd-fulfillment-date";

const at = new Date("2026-06-18T12:00:00+02:00");

const baseOrder = {
  subiekt_tw_id: 16893,
  symbol: "H364RNF 103 015",
  products: "Komet",
  mikran_code: null,
  quantity: "5",
  delivered_quantity: "0",
} as Pick<
  IndividualOrder,
  "subiekt_tw_id" | "symbol" | "products" | "mikran_code" | "quantity" | "delivered_quantity"
>;

describe("ZD ETA status filter", () => {
  it("otwarte statusy 5/6/7 są kwalifikowane", () => {
    for (const status of [
      ZD_DOCUMENT_STATUS_UNREALIZED,
      ZD_DOCUMENT_STATUS_UNREALIZED_NO_RESERVATION,
      ZD_DOCUMENT_STATUS_UNREALIZED_WITH_RESERVATION,
    ]) {
      expect(isZdEtaOpenDocumentStatus(status)).toBe(true);
      expect(
        isActiveZdFulfillmentDocument({
          dok_Status: status,
          dok_TerminRealizacji: "2026-07-15",
        })
      ).toBe(true);
    }
  });

  it("pomija zrealizowane (8) nawet z przyszłym terminem", () => {
    expect(isFulfilledZdDocumentStatus({ dok_Status: 8 })).toBe(true);
    expect(
      isActiveZdFulfillmentDocument({
        dok_Status: 8,
        dok_TerminRealizacji: "2099-01-01",
      })
    ).toBe(false);
    expect(shouldSkipZdListItemForEta({ dok_Status: 8 })).toBe(true);
  });

  it("bez statusu w liście API — nie pomija (weryfikacja po pełnym dokumencie)", () => {
    expect(shouldSkipZdListItemForEta({ dok_Status: null })).toBe(false);
    expect(shouldSkipZdListItemForEta({ dok_Status: undefined })).toBe(false);
  });

  it("bez statusu w dokumencie — wymaga terminu ≥ dziś", () => {
    expect(
      isActiveZdFulfillmentDocument({ dok_TerminRealizacji: "2026-07-15" }, at)
    ).toBe(true);
    expect(
      isActiveZdFulfillmentDocument({ dok_TerminRealizacji: "2026-02-27" }, at)
    ).toBe(false);
  });

  it("status 7 (z rezerwacją) akceptowany niezależnie od przeszłego terminu", () => {
    expect(
      isActiveZdFulfillmentDocument(
        { dok_Status: 7, dok_TerminRealizacji: "2020-01-01" },
        at
      )
    ).toBe(true);
  });

  it("częściowo zrealizowane: status 6 + reszta ilości wygrywa nad zrealizowanym 8", () => {
    const fulfilledFull: SubiektDocument = {
      dok_Id: 31,
      dok_Status: ZD_DOCUMENT_STATUS_FULFILLED,
      dok_TerminRealizacji: "2026-07-10",
      dok_Pozycja: [{ ob_TowId: 16893, tw_Symbol: "H364RNF 103 015", ob_Ilosc: 5 }],
    };
    const remainder: SubiektDocument = {
      dok_Id: 62,
      dok_Status: ZD_DOCUMENT_STATUS_UNREALIZED_NO_RESERVATION,
      dok_TerminRealizacji: "2026-07-20",
      dok_Pozycja: [{ ob_TowId: 16893, tw_Symbol: "H364RNF 103 015", ob_Ilosc: 3 }],
    };
    expect(
      findBestMatchingZdDocument(
        { ...baseOrder, quantity: "5", delivered_quantity: "2", zd_fulfillment_dok_id: 31 },
        [fulfilledFull, remainder],
        { at }
      )?.dok_Id
    ).toBe(62);
  });

  it("regresja: otwarty status 7 z przyszłym terminem wygrywa nad zrealizowanym", () => {
    const fulfilled: SubiektDocument = {
      dok_Id: 1,
      dok_Status: 8,
      dok_TerminRealizacji: "2099-01-01",
      dok_Pozycja: [{ ob_TowId: 7512, tw_Symbol: "606402", ob_Ilosc: 3 }],
    };
    const open: SubiektDocument = {
      dok_Id: 2,
      dok_Status: 7,
      dok_TerminRealizacji: "2026-07-15",
      dok_Pozycja: [{ ob_TowId: 7512, tw_Symbol: "606402", ob_Ilosc: 2 }],
    };
    expect(
      findBestMatchingZdDocument(
        { ...baseOrder, subiekt_tw_id: 7512, symbol: "606402", products: "Prod", quantity: "3" },
        [fulfilled, open],
        { at }
      )?.dok_Id
    ).toBe(2);
  });
});
