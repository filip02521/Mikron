import { SERVICE_WARRANTY_DEFAULT_MONTHS } from "@/lib/orders/service-warranty";

/**
 * Katalog modeli serwisu (/serwis/modele): jeden wpis na model sprzętu — części, które zwykle idą do jego naprawy,
 * i okres gwarancji. Na liście są modele z katalogu oraz modele, które serwis już zna jako sprzęt (był w naprawie
 * albo potwierdzony w „Sprzęt klienta”), żeby serwisant uzupełniał je od razu, bez szukania w Subiekcie.
 */

export type CatalogPart = {
  modelTwId: number;
  modelSymbol: string | null;
  modelName: string;
  partTwId: number;
  partSymbol: string | null;
  partName: string;
  defaultQty: number;
};

export type CatalogWarranty = { modelTwId: number; modelSymbol: string | null; modelName: string; months: number };

/** Model znany serwisowi jako sprzęt: z zleceń (`orders` > 0) albo z decyzji „to urządzenie”. */
export type CatalogKnownModel = { twId: number; symbol: string | null; name: string; orders: number };

export type CatalogModel = {
  twId: number;
  symbol: string | null;
  name: string;
  parts: CatalogPart[];
  months: number;
  /** Okres inny niż domyślny (zapisany w katalogu). */
  customMonths: boolean;
  /** Zlecenia serwisowe tego modelu (bez anulowanych). */
  orders: number;
};

export type CatalogGroup = "bez_czesci" | "z_czesciami";

export function buildModelCatalog(
  parts: readonly CatalogPart[],
  warranties: readonly CatalogWarranty[],
  known: readonly CatalogKnownModel[]
): CatalogModel[] {
  const m = new Map<number, CatalogModel>();
  const get = (twId: number, symbol: string | null, name: string): CatalogModel => {
    let cur = m.get(twId);
    if (!cur) {
      cur = { twId, symbol, name, parts: [], months: SERVICE_WARRANTY_DEFAULT_MONTHS, customMonths: false, orders: 0 };
      m.set(twId, cur);
    }
    return cur;
  };
  // Nazwy z katalogu (części, gwarancja) są świeższe — sprawdzone w Subiekcie przy zapisie; znane modele tylko uzupełniają.
  for (const p of parts) get(p.modelTwId, p.modelSymbol, p.modelName).parts.push(p);
  for (const w of warranties) {
    const cur = get(w.modelTwId, w.modelSymbol, w.modelName);
    cur.months = w.months;
    cur.customMonths = w.months !== SERVICE_WARRANTY_DEFAULT_MONTHS;
  }
  for (const k of known) {
    const cur = get(k.twId, k.symbol, k.name);
    cur.orders = Math.max(cur.orders, k.orders);
  }
  return [...m.values()];
}

export function catalogGroup(model: Pick<CatalogModel, "parts">): CatalogGroup {
  return model.parts.length ? "z_czesciami" : "bez_czesci";
}

/** Bez części: najpierw najczęściej naprawiane (tam podpowiedź oszczędzi najwięcej), potem alfabetycznie. */
export function sortCatalog(models: readonly CatalogModel[], group: CatalogGroup): CatalogModel[] {
  return [...models].sort((a, b) => (group === "bez_czesci" ? b.orders - a.orders : 0) || a.name.localeCompare(b.name, "pl"));
}

const norm = (s: string) => s.toLocaleLowerCase("pl").replace(/\s+/g, " ").trim();

/** Szukanie po nazwie i symbolu modelu oraz po symbolu i nazwie jego części; każde słowo musi pasować. */
export function catalogMatches(model: CatalogModel, query: string): boolean {
  const words = norm(query).split(" ").filter(Boolean);
  if (!words.length) return true;
  const hay = norm([model.name, model.symbol ?? "", ...model.parts.flatMap((p) => [p.partName, p.partSymbol ?? ""])].join(" "));
  return words.every((w) => hay.includes(w));
}

/** Ilość zwykle pobierana do naprawy: liczba całkowita 1–999. */
export function clampCatalogQty(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(999, Math.max(1, Math.round(n)));
}
