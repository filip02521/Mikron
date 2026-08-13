/**
 * Automatyczne wykluczenie z kreatora ZD:
 * 1) po nazwie towaru (Subiekt `tw_Nazwa`) — outlet / wycofane,
 * 2) po katalogu zębów (`prosba_teeth_products`) — wszystkie SKU zębowe.
 *
 * Zęby: źródłem prawdy jest tabela admina. Nowy produkt dodany do
 * „produktów zębnych” trafia tu przy kolejnym bootstrap / Policz listę —
 * bez ręcznego dopisywania do `zd_estimate_exclusions`.
 *
 * Truncation nazw: pole w Subiekcie ma limit znaków, więc dopisek „WYCOFANE”
 * bywa ucięty („WYCOFAN”, „WYCOFA”, „WYCOF”) — czasem bez spacji przed
 * dopiskiem. Matcher łapie tokeny osobne oraz sklejony sufiks nazwy.
 */

export type ZdNameAutoExcludeReason = "outlet" | "wycofane" | "teeth";

export type ZdNameAutoExcludeMatch = {
  reason: ZdNameAutoExcludeReason;
  /** Fragment / token / etykieta (do UI / debug). */
  matched: string;
};

/** Pełne słowo bazowe — od niego liczymy ucięcia. */
export const ZD_NAME_EXCLUDE_WYCOFANE = "wycofane";

/**
 * Minimalna długość uciętego prefiksu „wycofane”.
 * „wycof” (5) jest jeszcze charakterystyczne; krótsze („wyco”) zbyt ryzykowne.
 */
export const ZD_NAME_EXCLUDE_WYCOFANE_MIN_PREFIX = 5;

export function formatZdNameAutoExcludeLabel(
  reason: ZdNameAutoExcludeReason
): string {
  if (reason === "outlet") return "outlet";
  if (reason === "wycofane") return "wycofane";
  return "zęby";
}

/** Badge / title w tabeli szacunku. */
export function formatZdNameAutoExcludeBadge(
  reason: ZdNameAutoExcludeReason
): string {
  return `auto · ${formatZdNameAutoExcludeLabel(reason)}`;
}

function normalizeNazwa(nazwa: string): string {
  return String(nazwa ?? "")
    .normalize("NFKC")
    .toLowerCase();
}

/** Tokeny alfanumeryczne — „WYCOFA.” / „(OUTLET)” / „-wycofane” działają. */
function tokenizeNazwa(normalizedLower: string): string[] {
  return normalizedLower.match(/[a-z0-9]+/g) ?? [];
}

/**
 * Czy token to outlet (cały token lub z dopiskiem, np. outletowy).
 * Świadomie substring w tokenie — w asortymencie dent. „outlet” = celowe oznaczenie.
 */
function isOutletToken(token: string): boolean {
  return token.includes("outlet");
}

/**
 * wycofane / wycofany / … oraz ucięcia prefiksu „wycofane” (≥ min).
 * Wymaga startu od „wycof”, żeby nie łapać przypadkowych słów.
 */
export function isWycofaneNameToken(token: string): boolean {
  const t = token.toLowerCase();
  if (t.length < ZD_NAME_EXCLUDE_WYCOFANE_MIN_PREFIX) return false;
  if (!t.startsWith("wycof")) return false;

  // Rodzina form: wycofane, wycofany, wycofana, wycofanych, wycofanie…
  if (t.startsWith("wycofan")) return true;

  // Ucięcie na limicie nazwy: token jest prefiksem „wycofane”
  // (wycof / wycofa / wycofan — „wycofan” już powyżej).
  if (ZD_NAME_EXCLUDE_WYCOFANE.startsWith(t)) return true;

  return false;
}

/**
 * Sufiks całej nazwy = wycofane / forma / ucięcie — także gdy sklejone bez spacji
 * (`…ProduktWYCOFA`). Najdłuższy pasujący prefiks „wycofane”, potem `wycofan…`.
 */
export function matchWycofaneGluedSuffix(normalizedLower: string): string | null {
  const lower = normalizedLower.toLowerCase();
  if (!lower) return null;

  for (
    let len = ZD_NAME_EXCLUDE_WYCOFANE.length;
    len >= ZD_NAME_EXCLUDE_WYCOFANE_MIN_PREFIX;
    len -= 1
  ) {
    const prefix = ZD_NAME_EXCLUDE_WYCOFANE.slice(0, len);
    if (lower.endsWith(prefix)) return prefix;
  }

  // Formy sklejone: …wycofany / …wycofanych / …wycofanie
  const form = lower.match(/wycofan[a-z0-9]*$/);
  if (form && form[0].length >= ZD_NAME_EXCLUDE_WYCOFANE_MIN_PREFIX) {
    return form[0];
  }

  return null;
}

/**
 * Czy nazwa towaru kwalifikuje się do auto-wykluczenia po nazwie.
 * Pierwszy trafiony powód wygrywa (outlet przed wycofane).
 * Zęby są osobno — po `tw_Id` z katalogu, nie po nazwie.
 */
export function matchZdNameAutoExclude(
  nazwa: string
): ZdNameAutoExcludeMatch | null {
  const raw = String(nazwa ?? "").trim();
  if (!raw) return null;

  const lower = normalizeNazwa(raw);
  const tokens = tokenizeNazwa(lower);

  for (const token of tokens) {
    if (isOutletToken(token)) {
      return { reason: "outlet", matched: token };
    }
  }

  for (const token of tokens) {
    if (isWycofaneNameToken(token)) {
      return { reason: "wycofane", matched: token };
    }
  }

  const glued = matchWycofaneGluedSuffix(lower);
  if (glued) {
    return { reason: "wycofane", matched: glued };
  }

  return null;
}

export function isZdNameAutoExcluded(nazwa: string): boolean {
  return matchZdNameAutoExclude(nazwa) != null;
}

function toTwIdSet(
  ids?: ReadonlySet<number> | readonly number[] | null
): Set<number> {
  if (!ids) return new Set();
  if (ids instanceof Set) {
    const out = new Set<number>();
    for (const id of ids) {
      const n = Math.trunc(Number(id));
      if (n > 0) out.add(n);
    }
    return out;
  }
  const out = new Set<number>();
  for (const id of ids) {
    const n = Math.trunc(Number(id));
    if (n > 0) out.add(n);
  }
  return out;
}

/**
 * Mapa tw_Id → powód auto-wykluczenia (nazwa + katalog zębów).
 * Priorytet: outlet / wycofane z nazwy, potem zęby z katalogu.
 */
export function mapZdNameAutoExcludedByTwId(
  lines: ReadonlyArray<{ tw_Id: number; tw_Nazwa: string }>,
  options?: {
    /** `prosba_teeth_products.subiekt_tw_id` — nowe pozycje w adminie wchodzą tu. */
    teethTwIds?: ReadonlySet<number> | readonly number[] | null;
  }
): Map<number, ZdNameAutoExcludeMatch> {
  const map = new Map<number, ZdNameAutoExcludeMatch>();
  const teeth = toTwIdSet(options?.teethTwIds);
  for (const line of lines) {
    const twId = Math.trunc(Number(line.tw_Id));
    if (!(twId > 0)) continue;
    const hit = matchZdNameAutoExclude(line.tw_Nazwa);
    if (hit) {
      map.set(twId, hit);
      continue;
    }
    if (teeth.has(twId)) {
      map.set(twId, { reason: "teeth", matched: "zęby" });
    }
  }
  return map;
}

/**
 * Łączy wykluczenia z bazy + auto z nazwy + katalog zębów — do sum qty / TSV / filtrów.
 */
export function mergeZdEstimateExcludedTwIds(
  lines: ReadonlyArray<{ tw_Id: number; tw_Nazwa: string }>,
  dbExcludedTwIds?: ReadonlySet<number> | readonly number[] | null,
  options?: {
    teethTwIds?: ReadonlySet<number> | readonly number[] | null;
  }
): Set<number> {
  const set =
    dbExcludedTwIds instanceof Set
      ? new Set(dbExcludedTwIds)
      : new Set(dbExcludedTwIds ?? []);
  for (const line of lines) {
    if (isZdNameAutoExcluded(line.tw_Nazwa)) set.add(line.tw_Id);
  }
  for (const id of toTwIdSet(options?.teethTwIds)) {
    set.add(id);
  }
  return set;
}
