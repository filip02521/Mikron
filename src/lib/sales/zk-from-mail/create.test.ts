import { describe, expect, it } from "vitest";
import { previewSymbols, validateZkCreateRequest, zkCreateFailure, zkReadbackMismatches } from "./create";
import { SubiektNetworkError, SubiektRequestError, SubiektTimeoutError } from "@/lib/subiekt/errors";

describe("validateZkCreateRequest", () => {
  it("przepuszcza poprawny podgląd i przycina uwagi", () => {
    const r = validateZkCreateRequest({ khId: 10, lines: [{ towarId: 1, ilosc: "2,5".replace(",", ".") }], uwagi: "  z maila  " });
    expect(r).toEqual({ ok: true, body: { kontrahentId: 10, pozycje: [{ towarId: 1, ilosc: 2.5 }], uwagi: "z maila" } });
  });

  it.each([
    [{ khId: 0, lines: [{ towarId: 1, ilosc: 1 }] }, "Wybierz klienta."],
    [{ khId: 10, lines: [] }, "Dodaj co najmniej jedną pozycję."],
    [{ khId: 10, lines: [{ towarId: null, ilosc: 1 }] }, "Pozycja 1: wybierz towar."],
    [{ khId: 10, lines: [{ towarId: 1, ilosc: 0 }] }, "Pozycja 1: wpisz ilość większą od zera."],
    [{ khId: "1; DROP", lines: [{ towarId: 1, ilosc: 1 }] }, "Wybierz klienta."],
  ])("odrzuca %j", (input, message) => {
    expect(validateZkCreateRequest(input)).toEqual({ ok: false, message });
  });
});

describe("zkReadbackMismatches", () => {
  const sent = { kontrahentId: 10, pozycje: [{ towarId: 1, ilosc: 2 }, { towarId: 3, ilosc: 5 }], uwagi: null };

  it("zgodne ZK = brak różnic, także gdy towar jest w dwóch liniach", () => {
    expect(
      zkReadbackMismatches(sent, {
        dok_Id: 1,
        dok_OdbiorcaId: 10,
        dok_Pozycja: [{ ob_TowId: 1, ob_Ilosc: 1 }, { ob_TowId: 1, ob_Ilosc: 1 }, { ob_TowId: 3, ob_Ilosc: 5 }],
      })
    ).toEqual([]);
  });

  it("pokazuje innego klienta, brak, inną ilość i dodatkowy towar", () => {
    expect(
      zkReadbackMismatches(sent, {
        dok_Id: 1,
        dok_OdbiorcaId: 11,
        dok_Pozycja: [{ ob_TowId: 1, ob_Ilosc: 3 }, { ob_TowId: 9, ob_Ilosc: 1 }],
      })
    ).toEqual(["inny klient na ZK", "towar nr 1: 3 zamiast 2", "brak na ZK: towar nr 3", "spoza podglądu: towar nr 9"]);
  });
});

describe("zkReadbackMismatches — etykiety", () => {
  it("symbol z podglądu, potem z ZK, na końcu numer", () => {
    const sent = { kontrahentId: 10, pozycje: [{ towarId: 1, ilosc: 2 }, { towarId: 3, ilosc: 5 }], uwagi: null };
    expect(
      zkReadbackMismatches(sent, { dok_Id: 1, dok_OdbiorcaId: 10, dok_Pozycja: [{ ob_TowId: 1, ob_Ilosc: 1 }, { ob_TowId: 9, ob_Ilosc: 1, tw_Symbol: "XY-9" }] }, previewSymbols([{ towarId: 1, symbol: "AB-1" }, { towarId: 3, symbol: "CD-3" }]))
    ).toEqual(["AB-1: 1 zamiast 2", "brak na ZK: CD-3", "spoza podglądu: XY-9"]);
  });
});

describe("zkCreateFailure", () => {
  it("odmowa Sfery z powodem = pewny błąd z powodem", () => {
    expect(zkCreateFailure(new SubiektRequestError(400, JSON.stringify({ error: "Brak towaru 3527" })))).toEqual({
      message: "Subiekt nie utworzył ZK: Brak towaru 3527",
      uncertain: false,
    });
  });

  it("odmowa połączenia = ZK nie powstało", () => {
    const refused = Object.assign(new Error("connect ECONNREFUSED 192.0.2.1:5082"), { code: "ECONNREFUSED" });
    const fetchFailed = Object.assign(new TypeError("fetch failed"), { cause: refused });
    expect(zkCreateFailure(new SubiektNetworkError("fetch failed", fetchFailed)).uncertain).toBe(false);
    expect(zkCreateFailure(new SubiektRequestError(503, "{}")).uncertain).toBe(false);
  });

  it("przekroczony czas, zerwane połączenie, 2xx bez numeru = wynik nieznany", () => {
    expect(zkCreateFailure(new SubiektTimeoutError(180000)).uncertain).toBe(true);
    expect(zkCreateFailure(new SubiektNetworkError("socket hang up")).uncertain).toBe(true);
    expect(zkCreateFailure(new Error("Subiekt create ZK: brak dok_Id w odpowiedzi.")).uncertain).toBe(true);
    expect(zkCreateFailure(new SubiektRequestError(201, "Odpowiedź create ZK nie jest JSON")).uncertain).toBe(true);
    expect(zkCreateFailure(new SubiektRequestError(500, "{}")).uncertain).toBe(true);
    expect(zkCreateFailure(new SubiektRequestError(504, "{}")).uncertain).toBe(true);
  });
});
