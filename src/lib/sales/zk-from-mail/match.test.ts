import { describe, expect, it } from "vitest";
import { matchZkClient, matchZkLine, matchZkMail, nameQueries, nipSearchForms, type ZkMatchDeps } from "./match";
import { parseMailLine } from "./parse";
import type { SubiektKontrahent, SubiektProduct } from "@/lib/subiekt/types";

const PRODUCTS: SubiektProduct[] = [
  { tw_Id: 1, tw_Symbol: "517019", tw_Nazwa: "Rękawice nitrylowe M" },
  { tw_Id: 2, tw_Symbol: "517019-L", tw_Nazwa: "Rękawice nitrylowe L" },
  { tw_Id: 3, tw_Symbol: "WD-K012", tw_Nazwa: "Wiertło diamentowe kulka 012" },
  { tw_Id: 4, tw_Symbol: "WD-K014", tw_Nazwa: "Wiertło diamentowe kulka 014" },
  { tw_Id: 5, tw_Symbol: "OLD-1", tw_Nazwa: "Wiertło diamentowe kulka stare", tw_Zablokowany: 1 },
  { tw_Id: 6, tw_Symbol: "DUP-100", tw_Nazwa: "Gips A" },
  { tw_Id: 7, tw_Symbol: "DUP-100", tw_Nazwa: "Gips B" },
  { tw_Id: 8, tw_Symbol: "F3B", tw_Nazwa: "Drukarka 3D Form 3B" },
  { tw_Id: 9, tw_Symbol: "F4B", tw_Nazwa: "Drukarka 3D Form 4B" },
];

const CLIENTS: SubiektKontrahent[] = [
  { kh_Id: 10, kh_EMail: "zamowienia@przyklad-dental.pl", adr_Nazwa: "Przykład Dental", adr_NIP: "000-000-00-00" },
  { kh_Id: 11, kh_EMail: "biuro@przyklad-dental.pl", adr_Nazwa: "Przykład Dental oddział" },
  { kh_Id: 12, kh_EMail: "anna@gmail.com", adr_Nazwa: "Gabinet Wymyślony" },
  { kh_Id: 13, kh_EMail: "", adr_Nazwa: "Pracownia z kreskami", adr_NIP: "111-222-33-44" },
];

const contains = (hay: unknown, needle: string) => String(hay ?? "").toLowerCase().includes(needle.toLowerCase());

/** Jak API: symbol = dokładny, search = każde słowo jako podciąg nazwy lub symbolu. */
const deps: ZkMatchDeps = {
  async searchProducts({ symbol, search, pageSize }) {
    const rows = symbol
      ? PRODUCTS.filter((p) => p.tw_Symbol === symbol)
      : PRODUCTS.filter((p) => search!.split(" ").every((w) => contains(`${p.tw_Nazwa} ${p.tw_Symbol}`, w)));
    return rows.slice(0, pageSize);
  },
  async searchClients({ search, pageSize }) {
    return CLIENTS.filter((k) => contains(k.kh_EMail, search) || contains(k.adr_NIP, search)).slice(0, pageSize);
  },
};

const line = (text: string) => parseMailLine(text)!;

describe("matchZkLine", () => {
  it("jednoznaczny symbol z maila = pewne", async () => {
    const m = await matchZkLine(line("517019 rękawice – 10 op."), deps);
    expect(m).toMatchObject({ level: "pewne", quantity: 10, chosen: { towarId: 1 } });
  });

  it("po nazwie = kandydaci bez wyboru, zablokowany towar pominięty", async () => {
    const m = await matchZkLine(line("wiertła diamentowe kulka 012 x 5"), deps);
    expect(m.level).toBe("do_sprawdzenia");
    expect(m.chosen).toBeNull();
    expect(m.candidates.map((c) => c.towarId)).toEqual([3, 4]);
  });

  it("ten sam symbol na dwóch kartach = do sprawdzenia, nie zgadujemy", async () => {
    const m = await matchZkLine(line("DUP-100 2 szt"), deps);
    expect(m.level).toBe("do_sprawdzenia");
    expect(m.chosen).toBeNull();
    expect(m.candidates.map((c) => c.towarId).sort()).toEqual([6, 7]);
  });

  it("dopisek przed nazwą nie blokuje wyszukiwania", async () => {
    const m = await matchZkLine(line("Pracownia: wiertła diamentowe kulka 012 x 3"), deps);
    expect(m.candidates.map((c) => c.towarId)).toEqual([3, 4]);
  });

  it("krótki kod z maila ustawia właściwą drukarkę na górze", async () => {
    const m = await matchZkLine(line("1 szt. - Drukarka 3D Form 4B"), deps);
    expect(m.candidates[0]?.towarId).toBe(9);
  });

  it("brak w Subiekcie = brak", async () => {
    const m = await matchZkLine(line("3 szt. tego samego kompozytu co ostatnio"), deps);
    expect(m).toMatchObject({ level: "brak", chosen: null, candidates: [] });
  });
});

describe("matchZkClient", () => {
  it("adres z karty = pewne", async () => {
    const c = await matchZkClient({ senderEmail: "zamowienia@przyklad-dental.pl", nip: null }, deps);
    expect(c).toMatchObject({ level: "pewne", chosen: { khId: 10 } });
  });

  it("nieznany adres w firmowej domenie = kandydaci z domeny", async () => {
    const c = await matchZkClient({ senderEmail: "nowa@przyklad-dental.pl", nip: null }, deps);
    expect(c.level).toBe("do_sprawdzenia");
    expect(c.candidates.map((k) => k.khId)).toEqual([10, 11]);
  });

  it("nieznany adres na darmowej skrzynce = brak, nie podpowiadamy obcych gmaili", async () => {
    const c = await matchZkClient({ senderEmail: "ktos@gmail.com", nip: null }, deps);
    expect(c.level).toBe("brak");
  });

  it("NIP zapisany na karcie z kreskami też jest pewny", async () => {
    const c = await matchZkClient({ senderEmail: null, nip: "1112223344" }, deps);
    expect(c).toMatchObject({ level: "pewne", chosen: { khId: 13 } });
  });

  it("NIP z maila, gdy adresu nie ma na karcie", async () => {
    const c = await matchZkClient({ senderEmail: "ktos@gmail.com", nip: "0000000000" }, deps);
    expect(c).toMatchObject({ level: "pewne", chosen: { khId: 10 } });
  });
});

describe("nameQueries", () => {
  it("od najwęższego, bez powtórzeń", () => {
    expect(nameQueries(["a", "b", "c", "d"])).toEqual([["a", "b", "c"], ["b", "c", "d"], ["a", "b"], ["b", "c"]]);
    expect(nameQueries(["a"])).toEqual([["a"]]);
  });
});

describe("nipSearchForms", () => {
  it("trzy zapisy NIP-u, zły NIP = brak", () => {
    expect(nipSearchForms("1112223344")).toEqual(["1112223344", "111-222-33-44", "111-22-23-344"]);
    expect(nipSearchForms("123")).toEqual([]);
  });
});

describe("matchZkMail", () => {
  it("nie wysyła do Subiekta więcej niż 4 linie naraz, kolejność wyników jak w mailu", async () => {
    let inFlight = 0;
    let peak = 0;
    const slow: ZkMatchDeps = {
      ...deps,
      async searchProducts(params) {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return deps.searchProducts(params);
      },
    };
    const lines = Array.from({ length: 10 }, (_, i) => line(i % 2 ? "517019 – 1" : "DUP-100 2 szt"));
    const res = await matchZkMail({ senderEmail: null, onlyOwnSender: false, nip: null, lines }, slow);
    expect(peak).toBeLessThanOrEqual(4);
    expect(res.lines.map((l) => l.level)).toEqual(lines.map((_, i) => (i % 2 ? "pewne" : "do_sprawdzenia")));
  });
});
