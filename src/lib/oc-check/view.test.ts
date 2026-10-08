import { describe, expect, it } from "vitest";
import type { OcCheck } from "./types";
import { gmailThreadUrl, groupOcChecks, ocCheckView, parseOcView } from "./view";

function check(partial: Partial<OcCheck>): OcCheck {
  return {
    id: "id",
    mailbox: "",
    gmailThreadId: null,
    supplierName: "Dostawca",
    zdNumber: "",
    ocNumber: "",
    ocReceivedAt: null,
    status: "rozbieznosci",
    priority: 0,
    summary: "",
    nextStep: "",
    linesTotal: null,
    linesOk: null,
    resolvedAt: null,
    resolvedByName: null,
    resolutionNote: "",
    lines: [],
    ...partial,
  };
}

describe("ocCheckView", () => {
  it("rozstrzygnięte trafiają do wyjaśnionych, zgodne osobno, reszta do ruchu", () => {
    expect(ocCheckView(check({ resolvedAt: "2026-10-05T10:00:00Z", status: "zgodne" }))).toBe("wyjasnione");
    expect(ocCheckView(check({ status: "zgodne" }))).toBe("zgodne");
    expect(ocCheckView(check({ status: "czeka_na_nas" }))).toBe("do-ruchu");
    expect(ocCheckView(check({ status: "brak_oc" }))).toBe("do-ruchu");
  });
});

describe("groupOcChecks", () => {
  it("do ruchu: najpierw priorytet, potem najnowsze", () => {
    const groups = groupOcChecks([
      check({ id: "a", priority: 0, ocReceivedAt: "2026-10-05T12:00:00Z" }),
      check({ id: "b", priority: 2, ocReceivedAt: "2026-10-01T12:00:00Z" }),
      check({ id: "c", priority: 0, ocReceivedAt: "2026-10-05T13:00:00Z" }),
    ]);
    expect(groups["do-ruchu"].map((c) => c.id)).toEqual(["b", "c", "a"]);
  });
});

describe("parseOcView", () => {
  it("domyślnie do ruchu, nieznane wartości ignoruje", () => {
    expect(parseOcView(undefined)).toBe("do-ruchu");
    expect(parseOcView("zgodne")).toBe("zgodne");
    expect(parseOcView(["wyjasnione"])).toBe("wyjasnione");
    expect(parseOcView("<script>")).toBe("do-ruchu");
  });
});

describe("gmailThreadUrl", () => {
  it("zamienia id wątku na thread-f", () => {
    expect(gmailThreadUrl("filip.naskret@mikran.com", "1a10bd3a47bb83e6")).toBe(
      "https://mail.google.com/mail/?authuser=filip.naskret%40mikran.com#all/thread-f:1878209102622720998"
    );
  });

  it("bez poprawnego id zwraca null", () => {
    expect(gmailThreadUrl("x", null)).toBeNull();
    expect(gmailThreadUrl("x", "javascript:1")).toBeNull();
  });
});
