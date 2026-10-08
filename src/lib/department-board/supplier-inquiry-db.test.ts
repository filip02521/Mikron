import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/pool", () => ({ query: vi.fn() }));

import { supplierInquiryEmails } from "./supplier-inquiry-db";

describe("supplierInquiryEmails", () => {
  it("pole „maile” karty przed notatkami, bez duplikatów", () => {
    expect(
      supplierInquiryEmails({ mails: "Sales@DFS.de; orders@dfs.de", notes: "kontakt: orders@dfs.de, tech@dfs.de", extra_info: null })
    ).toEqual(["sales@dfs.de", "orders@dfs.de", "tech@dfs.de"]);
  });

  it("adresy Mikranu z notatek nigdy nie są odbiorcą", () => {
    expect(
      supplierInquiryEmails({ mails: null, notes: "zamawia jan.kowalski@mikran.com", extra_info: "info@3djake.pl, zakupy@ontime.mikran.pl" })
    ).toEqual(["info@3djake.pl"]);
  });

  it("brak adresów → pusta lista (dostawca znika z wyboru)", () => {
    expect(supplierInquiryEmails({ mails: "", notes: "tel. 61 000 00 00", extra_info: null })).toEqual([]);
  });
});
