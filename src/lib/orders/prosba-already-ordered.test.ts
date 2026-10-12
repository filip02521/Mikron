import { describe, expect, it } from "vitest";
import {
  buildProsbaAlreadyOrderedConfirm,
  buildProsbaAlreadyOrderedView,
  collectProsbaAlreadyOrderedTwIds,
  computeFreeIncoming,
  zkLineIncomingCover,
  sortProsbaOwnRequests,
  type ProsbaAlreadyOrderedInfo,
  type ProsbaIncoming,
  type ProsbaOwnRequestRef,
} from "@/lib/orders/prosba-already-ordered";

const TODAY = { todayKey: "2026-10-12" };

function own(over: Partial<ProsbaOwnRequestRef> = {}): ProsbaOwnRequestRef {
  return {
    id: "r1",
    phase: "ordered",
    createdAt: "2026-10-06T08:00:00.000Z",
    orderedAt: "2026-10-06T10:00:00.000Z",
    quantity: 5,
    deliveredQuantity: 0,
    supplierName: "Ivoclar",
    ...over,
  };
}

function incoming(over: Partial<ProsbaIncoming> = {}): ProsbaIncoming {
  const base = { incoming: 50, available: -3, zkWaiting: 37, docs: [] as ProsbaIncoming["docs"] };
  const merged = { ...base, ...over };
  return { ...merged, freeIncoming: over.freeIncoming ?? computeFreeIncoming(merged) };
}

function info(over: Partial<ProsbaAlreadyOrderedInfo> = {}): ProsbaAlreadyOrderedInfo {
  return { own: [], incoming: null, ...over };
}

describe("computeFreeIncoming", () => {
  it("dostawa minus czekające ZK i braki do rezerwacji, w granicach [0, w drodze]", () => {
    expect(computeFreeIncoming({ incoming: 50, available: -3, zkWaiting: 37 })).toBe(10);
    expect(computeFreeIncoming({ incoming: 35, available: 0, zkWaiting: 9 })).toBe(26);
    expect(computeFreeIncoming({ incoming: 0, available: -2, zkWaiting: 6 })).toBe(0);
    expect(computeFreeIncoming({ incoming: 10, available: 0, zkWaiting: 40 })).toBe(0);
    // Stan na półce obsłuży część ZK — wolne nie przekracza tego, co jedzie.
    expect(computeFreeIncoming({ incoming: 10, available: 30, zkWaiting: 5 })).toBe(10);
  });
});

describe("sortProsbaOwnRequests", () => {
  it("częściowo / zamówione przed czekającymi, potem najnowsze", () => {
    const sorted = sortProsbaOwnRequests([
      own({ id: "pending", phase: "pending", createdAt: "2026-10-10T00:00:00Z" }),
      own({ id: "old", phase: "ordered", createdAt: "2026-10-01T00:00:00Z" }),
      own({ id: "partial", phase: "partial", createdAt: "2026-09-15T00:00:00Z" }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(["partial", "old", "pending"]);
  });
});

describe("buildProsbaAlreadyOrderedView", () => {
  it("nic nie jedzie i brak dubla → nic", () => {
    expect(buildProsbaAlreadyOrderedView(undefined)).toBeNull();
    expect(buildProsbaAlreadyOrderedView(info())).toBeNull();
    expect(buildProsbaAlreadyOrderedView(info({ incoming: incoming({ incoming: 0 }) }))).toBeNull();
  });

  it("w drodze i wolne wystarczająco: zielone, powiadomienie, pytanie przy wysyłce", () => {
    const view = buildProsbaAlreadyOrderedView(
      info({
        incoming: incoming({
          docs: [{ dokNr: "123/10/2026", issued: "2026-10-06", deadline: "2026-10-21", qty: 50 }],
        }),
      }),
      { ...TODAY, requestedQty: 4 }
    )!;
    expect(view.tone).toBe("free");
    expect(view.title).toBe("Towar jest w drodze - wolne 10 szt.");
    expect(view.details).toEqual([
      "50 szt. w drodze · 37 szt. czeka na zamówienia klientów · 3 szt. brakuje do rezerwacji",
      "ZD 123/10/2026 · 50 szt. · z 06.10 · termin 21.10",
    ]);
    expect(view.suggestNotify).toBe(true);
    expect(view.confirmOnSubmit).toBe(true);
  });

  it("wolne mniej niż potrzeba: informacja o brakującej ilości, bez pytania", () => {
    const view = buildProsbaAlreadyOrderedView(info({ incoming: incoming() }), {
      ...TODAY,
      requestedQty: 25,
    })!;
    expect(view.tone).toBe("partial");
    expect(view.title).toBe("W drodze wolne tylko 10 szt.");
    expect(view.advice).toContain("brakuje 15 szt.");
    expect(view.suggestNotify).toBe(false);
    expect(view.confirmOnSubmit).toBe(false);
  });

  it("całość dla zamówień klientów: zamów normalnie, bez pytania", () => {
    const view = buildProsbaAlreadyOrderedView(
      info({ incoming: incoming({ incoming: 10, available: 0, zkWaiting: 40 }) }),
      TODAY
    )!;
    expect(view.tone).toBe("claimed");
    expect(view.advice).toBe("Nic z tej dostawy nie zostanie wolne - zamów normalnie.");
    expect(view.confirmOnSubmit).toBe(false);
  });

  it("termin ZD w przeszłości: niepewne, bez pytania przy wysyłce; reszta w innych ZD", () => {
    const view = buildProsbaAlreadyOrderedView(
      info({ incoming: incoming({ docs: [{ dokNr: "ZD 7/09", issued: null, deadline: "2026-09-03", qty: 5 }] }) }),
      { ...TODAY, requestedQty: 2 }
    )!;
    expect(view.tone).toBe("uncertain");
    expect(view.title).toBe("W drodze wolne 10 szt. - ale termin ZD minął");
    expect(view.details[1]).toBe("ZD 7/09 · 5 szt. · termin 03.09 minął - dostawa spóźniona");
    expect(view.details[2]).toBe("+45 szt. w innych otwartych ZD");
    expect(view.suggestNotify).toBe(true);
    expect(view.confirmOnSubmit).toBe(false);
  });

  it("bez znalezionego ZD: termin nieznany, bez pytania przy wysyłce", () => {
    const view = buildProsbaAlreadyOrderedView(info({ incoming: incoming() }), { ...TODAY, requestedQty: 2 })!;
    expect(view.tone).toBe("uncertain");
    expect(view.badge).toBe("W drodze, bez terminu");
    expect(view.confirmOnSubmit).toBe(false);
  });

  it("własny dubel wygrywa nad dostawą; tryb „w imieniu” bez „Twoja”", () => {
    const mine = buildProsbaAlreadyOrderedView(info({ own: [own({ phase: "pending" })], incoming: incoming() }))!;
    expect(mine.tone).toBe("mine");
    expect(mine.title).toBe("Masz już otwartą prośbę na ten towar");
    expect(mine.details[0]).toBe("Twoja prośba · 5 szt. · z 06.10 - czeka na zamówienie");
    expect(mine.confirmOnSubmit).toBe(true);
    const other = buildProsbaAlreadyOrderedView(info({ own: [own()] }), { forOther: true })!;
    expect(other.title).toBe("Ten towar już zamówiono z prośby tego handlowca");
    expect(other.details[0]).toBe("Prośba tego handlowca · 5 szt. · zamówiona 06.10 u Ivoclar");
    expect(other.badge).toBe("Ma już prośbę");
  });
});

describe("buildProsbaAlreadyOrderedView - zamówione, a w Subiekcie nic nie jedzie", () => {
  it("rada: zapytaj zakupy zamiast składać kolejną", () => {
    const view = buildProsbaAlreadyOrderedView(
      info({ own: [own()], incoming: incoming({ incoming: 0, available: -2, zkWaiting: 6 }) })
    )!;
    expect(view.tone).toBe("mine");
    expect(view.advice).toContain("zapytaj zakupy, co z tym zamówieniem");
  });
});

describe("collectProsbaAlreadyOrderedTwIds", () => {
  it("tylko zamówienie, tylko pozycje z Subiekta, bez duplikatów", () => {
    const lines = [{ subiektTwId: 5 }, { subiektTwId: 5 }, { subiektTwId: null }, { subiektTwId: 2 }];
    expect(collectProsbaAlreadyOrderedTwIds(lines, "zamowienie")).toEqual([2, 5]);
    expect(collectProsbaAlreadyOrderedTwIds(lines, "informacja")).toEqual([]);
  });

  it("pomija zęby — zawsze zamawiane pod pacjenta", () => {
    expect(collectProsbaAlreadyOrderedTwIds([{ subiektTwId: 5 }, { subiektTwId: 2 }], "zamowienie", new Set([5]))).toEqual([2]);
  });
});

describe("buildProsbaAlreadyOrderedConfirm", () => {
  const lines = [
    { subiektTwId: 1, symbol: "A-1", product: "Towar A", quantity: "4" },
    { subiektTwId: 2, symbol: "", product: "Towar B", quantity: "50" },
    { subiektTwId: 3, symbol: "C-3", product: "Towar C", quantity: "1" },
  ];

  it("pyta o wolne w drodze (wystarcza); pomija częściowe i zajęte", () => {
    const future = [{ dokNr: "1/10", issued: "2026-10-06", deadline: "2099-10-21", qty: 50 }];
    const confirm = buildProsbaAlreadyOrderedConfirm(lines, "zamowienie", {
      1: info({ incoming: incoming({ docs: future }) }),
      2: info({ incoming: incoming() }),
      3: info({ incoming: incoming({ incoming: 5, available: 0, zkWaiting: 9 }) }),
    });
    expect(confirm?.title).toBe("Ten towar jest już w drodze");
    expect(confirm?.summary).toBe("1 pozycja: A-1");
  });

  it("własny dubel ma osobny tytuł i treść", () => {
    const confirm = buildProsbaAlreadyOrderedConfirm(lines, "zamowienie", {
      1: info({ own: [own()] }),
      2: info({ own: [own({ phase: "pending" })] }),
    });
    expect(confirm?.title).toBe("Masz już prośby na te towary");
    expect(confirm?.summary).toBe("2 pozycje: A-1, Towar B");
  });

  it("wynik per pozycja — różni handlowcy z tym samym towarem", () => {
    const two = [
      { subiektTwId: 1, symbol: "X", product: "", quantity: "1", sp: "x" },
      { subiektTwId: 1, symbol: "Y", product: "", quantity: "1", sp: "y" },
    ];
    const confirm = buildProsbaAlreadyOrderedConfirm(two, "zamowienie", (l) =>
      l.sp === "x" ? info({ own: [own()] }) : undefined
    );
    expect(confirm?.summary).toBe("1 pozycja: X");
  });

  it("wystarczający stan z półki wygrywa z dostawą, ale nie z własnym dublem", () => {
    const future = [{ dokNr: "1/10", issued: "2026-10-06", deadline: "2099-10-21", qty: 50 }];
    const shelf = { shelfSufficient: () => true };
    expect(
      buildProsbaAlreadyOrderedConfirm(lines, "zamowienie", { 1: info({ incoming: incoming({ docs: future }) }) }, shelf)
    ).toBeNull();
    expect(
      buildProsbaAlreadyOrderedConfirm(lines, "zamowienie", { 1: info({ own: [own()] }) }, shelf)?.title
    ).toBe("Masz już prośbę na ten towar");
  });

  it("informacja nigdy nie pyta", () => {
    expect(buildProsbaAlreadyOrderedConfirm(lines, "informacja", { 1: info({ own: [own()] }) })).toBeNull();
  });
});

describe("pozycje z ZK — własne ZK nie zabiera dostawy samemu sobie", () => {
  // 50 w drodze, stan 0, czekające ZK 45, w tym 5 to ZK tego klienta.
  const inc = () => incoming({ incoming: 50, available: 0, zkWaiting: 45 });

  it("karta formularza: wolne liczone bez własnego ZK", () => {
    const view = buildProsbaAlreadyOrderedView(
      info({ incoming: incoming({ incoming: 50, available: 0, zkWaiting: 45, docs: [{ dokNr: "1/10", issued: null, deadline: "2099-01-01", qty: 50 }] }) }),
      { ...TODAY, requestedQty: 5, ownZkQty: 5 }
    )!;
    expect(view.tone).toBe("free");
    expect(view.title).toBe("Towar jest w drodze - wolne 10 szt.");
  });

  it("w prośbie tylko brakująca część — półka nie liczy się drugi raz", () => {
    // ZK klienta 8 szt., półka 3, w drodze 4: razem 7 < 8, choć wpisano tylko 5.
    const view = buildProsbaAlreadyOrderedView(
      info({ incoming: incoming({ incoming: 4, available: 3, zkWaiting: 8, docs: [{ dokNr: "1/10", issued: null, deadline: "2099-01-01", qty: 4 }] }) }),
      { ...TODAY, requestedQty: 5, ownZkQty: 8 }
    )!;
    expect(view.tone).toBe("partial");
  });

  it("zkLineIncomingCover: pokrywa, pewne tylko z terminem w przód", () => {
    const withDoc = { ...inc(), docs: [{ dokNr: "1/10", issued: null, deadline: "2026-10-21", qty: 50 }] };
    expect(zkLineIncomingCover(withDoc, 5, "2026-10-12")).toMatchObject({ covered: true, certain: true, freeForLine: 10 });
    const late = { ...inc(), docs: [{ dokNr: "1/09", issued: null, deadline: "2026-09-01", qty: 50 }] };
    expect(zkLineIncomingCover(late, 5, "2026-10-12")).toMatchObject({ covered: true, certain: false });
    // Cudze ZK zabierają wszystko: 20 w drodze, 30 czekających (w tym 5 nasze).
    expect(zkLineIncomingCover(incoming({ incoming: 20, available: 0, zkWaiting: 30 }), 5, "2026-10-12")).toMatchObject({ covered: false });
    expect(zkLineIncomingCover(null, 5)).toBeNull();
  });
});
