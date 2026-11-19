/**
 * Dopasowanie przeczytanego maila do Subiekta: klient i towary z miarą pewności.
 * Zasada: `towarId` / `kh_Id` jest wybrany sam tylko przy dopasowaniu jednoznacznym (symbol z maila,
 * adres e-mail lub NIP z karty). W pozostałych przypadkach są kandydaci, a wybiera handlowiec.
 * Wyszukiwanie wstrzykiwane (`deps`) — testy bez sieci, serwer z hostem ZK.
 */

import { foldSearchText } from "@/lib/search/keywords";
import type { SubiektKontrahent, SubiektProduct } from "@/lib/subiekt/types";
import type { ParsedMail, ParsedMailLine } from "./parse";

export type MatchLevel = "pewne" | "do_sprawdzenia" | "brak";

export type ZkProductOption = { towarId: number; symbol: string; nazwa: string };
export type ZkClientOption = { khId: number; nazwa: string; nip: string; miejscowosc: string; email: string };

export type MatchedZkLine = {
  text: string;
  quantity: number | null;
  level: MatchLevel;
  /** Ustawione tylko przy `pewne`. */
  chosen: ZkProductOption | null;
  candidates: ZkProductOption[];
  /** Skąd pewność albo dlaczego jej brak — krótko, dla handlowca. */
  reason: string;
};

export type MatchedZkClient = {
  level: MatchLevel;
  chosen: ZkClientOption | null;
  candidates: ZkClientOption[];
  reason: string;
};

export type ZkMailMatch = { client: MatchedZkClient; lines: MatchedZkLine[] };

export type ZkMatchDeps = {
  searchProducts(params: { symbol?: string; search?: string; pageSize: number }): Promise<SubiektProduct[]>;
  searchClients(params: { search: string; pageSize: number }): Promise<SubiektKontrahent[]>;
};

export const ZK_MATCH_MAX_CANDIDATES = 5;

/** Darmowe skrzynki — domena nie wskazuje firmy. */
const FREE_MAIL_DOMAINS = new Set([
  "gmail.com", "wp.pl", "o2.pl", "onet.pl", "onet.eu", "op.pl", "interia.pl", "interia.eu", "poczta.fm",
  "tlen.pl", "gazeta.pl", "vp.pl", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "icloud.com",
  "me.com", "proton.me", "protonmail.com", "buziaczek.pl", "autograf.pl", "go2.pl",
]);

const clean = (v: unknown) => String(v ?? "").trim();

export function toProductOption(p: SubiektProduct): ZkProductOption {
  return { towarId: p.tw_Id, symbol: clean(p.tw_Symbol), nazwa: clean(p.tw_Nazwa) };
}

export function toClientOption(k: SubiektKontrahent): ZkClientOption {
  return {
    khId: k.kh_Id,
    nazwa: clean(k.adr_NazwaPelna) || clean(k.adr_Nazwa) || clean(k.kh_Symbol),
    nip: clean(k.adr_NIP),
    miejscowosc: clean(k.adr_Miejscowosc),
    email: clean(k.kh_EMail).toLowerCase(),
  };
}

const isActive = (p: SubiektProduct) => !p.tw_Zablokowany;

function rankByStems(products: SubiektProduct[], stems: string[], hints: string[] = []): SubiektProduct[] {
  const folded = stems.map(foldSearchText);
  const score = (p: SubiektProduct) => {
    const name = foldSearchText(`${p.tw_Nazwa ?? ""} ${p.tw_Symbol ?? ""}`);
    const words = new Set(name.split(/[^\p{L}\d]+/u));
    // Kod jako całe słowo („4B”) waży więcej niż rdzeń — odróżnia Form 4B od Form 3B.
    return folded.filter((s) => name.includes(s)).length + 2 * hints.filter((h) => words.has(foldSearchText(h))).length;
  };
  return [...products].sort((a, b) => score(b) - score(a));
}

function uniqueById(products: SubiektProduct[]): SubiektProduct[] {
  const seen = new Set<number>();
  return products.filter((p) => (seen.has(p.tw_Id) ? false : (seen.add(p.tw_Id), true)));
}

/**
 * Kolejne zapytania po nazwie: od najwęższego. Zdjęcie pierwszego słowa łapie dopiski przed nazwą
 * („Pracownia: wiertła…”). Najwyżej 4 zapytania na linię.
 */
export function nameQueries(stems: string[]): string[][] {
  const windows = [stems.slice(0, 3), stems.slice(1, 4), stems.slice(0, 2), stems.slice(1, 3)];
  const seen = new Set<string>();
  return windows.filter((w) => w.length > 0 && !seen.has(w.join(" ")) && (seen.add(w.join(" ")), true));
}

export async function matchZkLine(line: ParsedMailLine, deps: ZkMatchDeps): Promise<MatchedZkLine> {
  const base = { text: line.text, quantity: line.quantity };
  const fuzzy: SubiektProduct[] = [];

  for (const symbol of line.symbols) {
    const hits = (await deps.searchProducts({ symbol, pageSize: 10 })).filter(isActive);
    const exact = hits.filter((p) => foldSearchText(p.tw_Symbol) === foldSearchText(symbol));
    if (exact.length === 1) {
      return { ...base, level: "pewne", chosen: toProductOption(exact[0]!), candidates: [], reason: `symbol ${symbol} z maila` };
    }
    fuzzy.push(...exact, ...hits);
    if (exact.length === 0) {
      fuzzy.push(...(await deps.searchProducts({ search: symbol, pageSize: ZK_MATCH_MAX_CANDIDATES })).filter(isActive));
    }
  }

  if (line.nameStems.length > 0) {
    let hits: SubiektProduct[] = [];
    for (const words of nameQueries(line.nameStems)) {
      hits = (await deps.searchProducts({ search: words.join(" "), pageSize: 20 })).filter(isActive);
      if (hits.length > 0) break;
    }
    fuzzy.push(...rankByStems(hits, line.nameStems, line.hints));
  }

  const candidates = uniqueById(fuzzy).slice(0, ZK_MATCH_MAX_CANDIDATES).map(toProductOption);
  if (candidates.length === 0) {
    return { ...base, level: "brak", chosen: null, candidates: [], reason: "nie znaleziono w Subiekcie" };
  }
  return {
    ...base,
    level: "do_sprawdzenia",
    chosen: null,
    candidates,
    reason: line.symbols.length ? "symbol niejednoznaczny, podobne nazwy" : "po nazwie, bez symbolu",
  };
}

/** NIP w zapisach spotykanych na kartach: 1234567890, 123-456-78-90, 123-45-67-890. */
export function nipSearchForms(nip: string): string[] {
  const d = nip.replace(/\D/g, "");
  if (d.length !== 10) return [];
  return [d, `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}`, `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5, 7)}-${d.slice(7)}`];
}

/** Równoległość zapytań do Subiekta przy rozpoznawaniu linii (30 linii × kilka zapytań to za dużo naraz). */
const LINE_CONCURRENCY = 4;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function uniqueClients(list: SubiektKontrahent[]): ZkClientOption[] {
  const seen = new Set<number>();
  return list.filter((k) => (seen.has(k.kh_Id) ? false : (seen.add(k.kh_Id), true))).map(toClientOption);
}

export async function matchZkClient(
  mail: Pick<ParsedMail, "senderEmail" | "nip"> & Partial<Pick<ParsedMail, "onlyOwnSender">>,
  deps: ZkMatchDeps
): Promise<MatchedZkClient> {
  const email = mail.senderEmail?.toLowerCase() ?? null;
  if (email) {
    const exact = (await deps.searchClients({ search: email, pageSize: 10 })).filter(
      (k) => clean(k.kh_EMail).toLowerCase() === email
    );
    if (exact.length === 1) return { level: "pewne", chosen: toClientOption(exact[0]!), candidates: [], reason: "adres maila z karty klienta" };
    if (exact.length > 1) {
      return { level: "do_sprawdzenia", chosen: null, candidates: uniqueClients(exact).slice(0, ZK_MATCH_MAX_CANDIDATES), reason: "ten sam adres na kilku kartach" };
    }
  }
  if (mail.nip) {
    // Wyszukiwarka porównuje podciąg zapisanego NIP-u, a karty mają go raz bez kresek, raz z kreskami.
    const found: SubiektKontrahent[] = [];
    for (const form of nipSearchForms(mail.nip)) found.push(...(await deps.searchClients({ search: form, pageSize: 10 })));
    const exact = found.filter((k) => clean(k.adr_NIP).replace(/\D/g, "") === mail.nip);
    const unique = uniqueClients(exact);
    if (unique.length === 1) return { level: "pewne", chosen: unique[0]!, candidates: [], reason: "NIP z maila" };
    if (unique.length > 1) {
      return { level: "do_sprawdzenia", chosen: null, candidates: unique.slice(0, ZK_MATCH_MAX_CANDIDATES), reason: "ten sam NIP na kilku kartach" };
    }
  }
  const domain = email?.split("@")[1] ?? "";
  if (domain && !FREE_MAIL_DOMAINS.has(domain)) {
    const sameDomain = (await deps.searchClients({ search: `@${domain}`, pageSize: 20 })).filter((k) =>
      clean(k.kh_EMail).toLowerCase().endsWith(`@${domain}`)
    );
    if (sameDomain.length > 0) {
      return { level: "do_sprawdzenia", chosen: null, candidates: uniqueClients(sameDomain).slice(0, ZK_MATCH_MAX_CANDIDATES), reason: `domena ${domain}` };
    }
  }
  const reason = email
    ? "adresu nie ma na żadnej karcie"
    : mail.onlyOwnSender
      ? "w mailu jest tylko adres Mikranu, bez nagłówka klienta"
      : "w mailu nie ma adresu nadawcy";
  return { level: "brak", chosen: null, candidates: [], reason };
}

export async function matchZkMail(mail: ParsedMail, deps: ZkMatchDeps): Promise<ZkMailMatch> {
  const [client, lines] = await Promise.all([
    matchZkClient(mail, deps),
    mapLimit(mail.lines, LINE_CONCURRENCY, (l) => matchZkLine(l, deps)),
  ]);
  return { client, lines };
}
