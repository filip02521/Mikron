/**
 * Wnioskowanie ISO kraju dla Sellout Ivoclar.
 *
 * API nie zwraca `adr_IdPanstwo` / `pa_KodPanstwaISO`. Country bierzemy z lokalizacji
 * adresu: unikalny format kodu i miasto wygrywają z NIP/telefonem/e-mailem
 * (to kraj siedziby na FS, nie narodowość właściciela).
 *
 * Pięć cyfr bez myślnika NIE jest Polską — w praktyce CZ / SK / DE.
 */

import {
  IVOCLAR_CITIES_BY_COUNTRY,
  IVOCLAR_CITY_EXACT_ONLY,
} from "@/lib/orders/ivoclar-country-cities";

export type IvoclarPostalShape =
  | "empty"
  | "pl_hyphen"
  | "nl"
  | "lt"
  | "lv"
  | "ie"
  | "gb"
  | "pt"
  | "ca"
  | "jp"
  | "cz_sk_se_spaced"
  | "five_digits"
  | "four_digits"
  | "other";

export type IvoclarCountrySource =
  | "postal_format"
  | "city"
  | "vat"
  | "phone"
  | "email"
  | "diacritics";

export type IvoclarCountryConfidence = "high" | "medium" | "low";

export type IvoclarCountryInference = {
  country: string | null;
  confidence: IvoclarCountryConfidence | null;
  source: IvoclarCountrySource | null;
  conflict: boolean;
  conflictCountries: string[];
  postalShape: IvoclarPostalShape;
  postalRaw: string;
  postalForFile: string | null;
  cityNormalized: string;
  extractedPostalFromCity: string | null;
};

const UNIQUE_POSTAL_COUNTRY: Partial<Record<IvoclarPostalShape, string>> = {
  pl_hyphen: "PL",
  nl: "NL",
  lt: "LT",
  lv: "LV",
  ie: "IE",
  gb: "GB",
  pt: "PT",
  ca: "CA",
  jp: "JP",
};

/** Prefiks VAT UE / GB / EFTA → ISO 3166-1. `EL` to Grecja. */
const VAT_TO_ISO: Record<string, string> = {
  AT: "AT",
  BE: "BE",
  BG: "BG",
  CY: "CY",
  CZ: "CZ",
  DE: "DE",
  DK: "DK",
  EE: "EE",
  EL: "GR",
  GR: "GR",
  ES: "ES",
  FI: "FI",
  FR: "FR",
  HR: "HR",
  HU: "HU",
  IE: "IE",
  IT: "IT",
  LT: "LT",
  LU: "LU",
  LV: "LV",
  MT: "MT",
  NL: "NL",
  PL: "PL",
  PT: "PT",
  RO: "RO",
  SE: "SE",
  SI: "SI",
  SK: "SK",
  GB: "GB",
  UK: "GB",
  XI: "GB",
  CH: "CH",
  NO: "NO",
  UA: "UA",
  RS: "RS",
  BA: "BA",
  MK: "MK",
  TR: "TR",
};

/** Dłuższe kody przed krótszymi (`421` przed `42`). */
const CALLING_CODE_TO_ISO: Array<{ code: string; iso: string }> = [
  { code: "421", iso: "SK" },
  { code: "420", iso: "CZ" },
  { code: "370", iso: "LT" },
  { code: "371", iso: "LV" },
  { code: "372", iso: "EE" },
  { code: "353", iso: "IE" },
  { code: "351", iso: "PT" },
  { code: "358", iso: "FI" },
  { code: "386", iso: "SI" },
  { code: "385", iso: "HR" },
  { code: "359", iso: "BG" },
  { code: "352", iso: "LU" },
  { code: "380", iso: "UA" },
  { code: "423", iso: "LI" },
  { code: "43", iso: "AT" },
  { code: "49", iso: "DE" },
  { code: "48", iso: "PL" },
  { code: "47", iso: "NO" },
  { code: "46", iso: "SE" },
  { code: "45", iso: "DK" },
  { code: "44", iso: "GB" },
  { code: "41", iso: "CH" },
  { code: "40", iso: "RO" },
  { code: "39", iso: "IT" },
  { code: "36", iso: "HU" },
  { code: "34", iso: "ES" },
  { code: "33", iso: "FR" },
  { code: "32", iso: "BE" },
  { code: "31", iso: "NL" },
  { code: "30", iso: "GR" },
];

const GENERIC_EMAIL_TLDS = new Set([
  "com",
  "net",
  "org",
  "edu",
  "gov",
  "eu",
  "info",
  "biz",
  "io",
  "app",
  "dev",
  "co",
  "me",
  "online",
  "shop",
  "store",
]);

const EMAIL_TLD_TO_ISO: Record<string, string> = {
  pl: "PL",
  cz: "CZ",
  sk: "SK",
  de: "DE",
  at: "AT",
  be: "BE",
  nl: "NL",
  no: "NO",
  lt: "LT",
  lv: "LV",
  ee: "EE",
  ie: "IE",
  uk: "GB",
  hu: "HU",
  ch: "CH",
  dk: "DK",
  ua: "UA",
  se: "SE",
  fi: "FI",
  pt: "PT",
  fr: "FR",
  it: "IT",
  es: "ES",
  ro: "RO",
  bg: "BG",
  hr: "HR",
  si: "SI",
  gr: "GR",
};

const CZ_LETTERS = /[řěůŘĚŮ]/;
const SK_LETTERS = /[ĺŕäôľĽ]/;

export type IvoclarCityMatch = {
  country: string | null;
  countries: string[];
  exact: boolean;
};

/** 5 cyfr (lub NNN NN): DE, CZ, SK, FR… — nie AT/BE/NO. */
const FIVE_DIGIT_COUNTRIES = new Set([
  "DE",
  "FR",
  "IT",
  "ES",
  "FI",
  "EE",
  "UA",
  "HR",
  "RO",
  "BG",
  "CZ",
  "SK",
  "PL",
  "SE",
  "LT",
]);

/** 4 cyfry: AT, BE, NO, CH… — nie DE/CZ. */
const FOUR_DIGIT_COUNTRIES = new Set([
  "AT",
  "BE",
  "NO",
  "CH",
  "DK",
  "HU",
  "SI",
  "LU",
  "NL",
  "LV",
]);

let cityIndex: Map<string, string> | null = null;
let cityAmbiguous: Map<string, string[]> | null = null;

function foldCity(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['.`]/g, "")
    .replace(/[-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getCityIndex(): {
  index: Map<string, string>;
  ambiguous: Map<string, string[]>;
} {
  if (cityIndex && cityAmbiguous) return { index: cityIndex, ambiguous: cityAmbiguous };
  const index = new Map<string, string>();
  const ambiguous = new Map<string, string[]>();
  for (const [iso, names] of Object.entries(IVOCLAR_CITIES_BY_COUNTRY)) {
    for (const name of names) {
      const key = foldCity(name);
      if (!key) continue;
      const prevAmb = ambiguous.get(key);
      if (prevAmb) {
        if (!prevAmb.includes(iso)) prevAmb.push(iso);
        continue;
      }
      const prev = index.get(key);
      if (prev && prev !== iso) {
        ambiguous.set(key, [prev, iso]);
        index.delete(key);
      } else if (!prev) {
        index.set(key, iso);
      }
    }
  }
  cityIndex = index;
  cityAmbiguous = ambiguous;
  return { index, ambiguous };
}

export function disambiguateCityCountries(
  countries: readonly string[],
  shape: IvoclarPostalShape
): string | null {
  const unique = [...new Set(countries)];
  if (unique.length === 1) return unique[0] ?? null;
  if (shape === "five_digits" || shape === "cz_sk_se_spaced") {
    const hits = unique.filter((iso) => FIVE_DIGIT_COUNTRIES.has(iso));
    if (hits.length === 1) return hits[0] ?? null;
  }
  if (shape === "four_digits") {
    const hits = unique.filter((iso) => FOUR_DIGIT_COUNTRIES.has(iso));
    if (hits.length === 1) return hits[0] ?? null;
  }
  return null;
}

export function normalizeIvoclarCity(value: string | null | undefined): string {
  return foldCity(String(value ?? ""));
}

export function matchIvoclarCity(city: string | null | undefined): IvoclarCityMatch | null {
  const folded = foldCity(String(city ?? ""));
  if (!folded) return null;
  const { index, ambiguous } = getCityIndex();
  const amb = ambiguous.get(folded);
  if (amb && amb.length > 0) {
    return {
      country: amb.length === 1 ? amb[0]! : null,
      countries: [...amb].sort(),
      exact: true,
    };
  }
  const exact = index.get(folded);
  if (exact) return { country: exact, countries: [exact], exact: true };

  const hits = new Set<string>();
  for (const [name, iso] of index) {
    if (IVOCLAR_CITY_EXACT_ONLY.has(name)) continue;
    const allowShortContains = name === "dublin";
    if (name.length < 7 && !allowShortContains) continue;
    const re = new RegExp(`(?:^|\\s)${escapeRegExp(name)}(?:\\s|$)`);
    if (re.test(folded)) hits.add(iso);
  }
  if (hits.size === 1) {
    const country = [...hits][0]!;
    return { country, countries: [country], exact: false };
  }
  if (hits.size > 1) {
    return { country: null, countries: [...hits].sort(), exact: false };
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function czSkDiacriticsCountry(city: string | null | undefined): string | null {
  const raw = String(city ?? "");
  const cz = CZ_LETTERS.test(raw);
  const sk = SK_LETTERS.test(raw);
  if (cz && !sk) return "CZ";
  if (sk && !cz) return "SK";
  return null;
}

export function parseVatCountry(
  nip: string | null | undefined
): { iso: string; hasDigits: boolean } | null {
  const raw = String(nip ?? "").trim();
  if (!raw) return null;
  const m = raw.match(/^([A-Za-z]{2})(?:[\s.-]*)(.*)$/);
  if (!m) return null;
  const iso = VAT_TO_ISO[m[1]!.toUpperCase()];
  if (!iso) return null;
  const rest = (m[2] ?? "").replace(/[\s.-]/g, "");
  if (rest && !/^[A-Za-z0-9]+$/.test(rest)) return null;
  return { iso, hasDigits: /\d/.test(rest) };
}

export function parsePhoneCountry(phone: string | null | undefined): string | null {
  const raw = String(phone ?? "").replace(/[\s().-]/g, "");
  if (!raw) return null;
  let digits = raw;
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("+")) digits = digits.slice(1);
  else return null;
  if (!/^\d{6,15}$/.test(digits)) return null;
  for (const row of CALLING_CODE_TO_ISO) {
    if (digits.startsWith(row.code)) return row.iso;
  }
  return null;
}

export function parseEmailCountry(email: string | null | undefined): string | null {
  const raw = String(email ?? "").trim().toLowerCase();
  const at = raw.lastIndexOf("@");
  if (at < 0) return null;
  const host = raw.slice(at + 1);
  const tld = host.split(".").pop() ?? "";
  if (!tld || GENERIC_EMAIL_TLDS.has(tld)) return null;
  return EMAIL_TLD_TO_ISO[tld] ?? null;
}

export function classifyPostalShape(rawValue: string | null | undefined): {
  shape: IvoclarPostalShape;
  raw: string;
  compact: string;
} {
  const raw = String(rawValue ?? "").trim();
  const compact = raw.replace(/\s+/g, " ").trim();
  const nospace = compact.replace(/\s+/g, "");
  if (!compact) return { shape: "empty", raw: "", compact: "" };
  if (/^\d{2}-\d{3}$/.test(compact)) return { shape: "pl_hyphen", raw: compact, compact };
  if (/^\d{4}\s?[A-Z]{2}$/i.test(compact)) return { shape: "nl", raw: compact, compact };
  if (/^LT-?\d{5}$/i.test(nospace)) return { shape: "lt", raw: compact, compact };
  if (/^LV-?\d{4}$/i.test(nospace)) return { shape: "lv", raw: compact, compact };
  if (isIrishEircode(nospace)) {
    return { shape: "ie", raw: compact, compact };
  }
  if (/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(compact)) {
    return { shape: "gb", raw: compact, compact };
  }
  if (/^\d{4}-\d{3}$/.test(compact)) return { shape: "pt", raw: compact, compact };
  if (/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(compact)) return { shape: "ca", raw: compact, compact };
  if (/^\d{3}-\d{4}$/.test(compact)) return { shape: "jp", raw: compact, compact };
  if (/^\d{3}\s\d{2}$/.test(compact)) return { shape: "cz_sk_se_spaced", raw: compact, compact };
  if (/^\d{5}$/.test(nospace) && !compact.includes("-")) {
    return { shape: "five_digits", raw: compact, compact: nospace };
  }
  if (/^\d{4}$/.test(nospace)) return { shape: "four_digits", raw: compact, compact: nospace };
  return { shape: "other", raw: compact, compact };
}

/** Eircode: routing A99 / A9W + 4 znaki bez BGIJLOQSUZ — nie każdy 7-znakowy kod. */
const IE_EIRCODE_CHAR = "AC-FHKNPRTV-Y";
const IE_EIRCODE_RE = new RegExp(
  `^[${IE_EIRCODE_CHAR}](?:\\d{2}|\\dW)[0-9${IE_EIRCODE_CHAR}]{4}$`,
  "i"
);

function isIrishEircode(nospace: string): boolean {
  if (!IE_EIRCODE_RE.test(nospace)) return false;
  const unique = nospace.slice(3);
  return /[A-Z]/i.test(unique);
}

const YEAR_POSTAL = /^(?:19|20)\d{2}$/;

const EMBEDDED_POSTAL = [
  /(?:^|[\s,;/])(\d{2}-\d{3})\s*$/,
  /(?:^|[\s,;/])(\d{3}\s\d{2})\s*$/,
  /(?:^|[\s,;/])(\d{4}\s?[A-Z]{2})\s*$/i,
  /(?:^|[\s,;/])(LT-?\d{5})\s*$/i,
  /(?:^|[\s,;/])(\d{5})\s*$/,
  /(?:^|[\s,;/])(\d{4})\s*$/,
];

export function extractPostalFromCity(city: string | null | undefined): {
  city: string;
  postal: string | null;
} {
  const raw = String(city ?? "").trim();
  if (!raw) return { city: "", postal: null };
  for (const re of EMBEDDED_POSTAL) {
    const m = raw.match(re);
    if (!m || !m[1]) continue;
    const postal = m[1].trim();
    if (YEAR_POSTAL.test(postal)) continue;
    const cutAt = m.index ?? 0;
    const rest = raw.slice(0, cutAt).trim().replace(/[,\-/;]+$/, "").trim();
    if (rest.length >= 3) return { city: rest, postal };
  }
  return { city: raw, postal: null };
}

function formatPostalForCountry(
  country: string | null,
  shape: IvoclarPostalShape,
  raw: string
): string | null {
  const nospace = raw.replace(/\s+/g, "");
  if (!raw) return null;
  if (country === "PL") {
    if (/^\d{2}-\d{3}$/.test(raw)) return raw;
    if (/^\d{5}$/.test(nospace)) return `${nospace.slice(0, 2)}-${nospace.slice(2)}`;
    return raw;
  }
  if (country === "CZ" || country === "SK" || country === "SE") {
    if (/^\d{3}\s\d{2}$/.test(raw)) return raw;
    if (/^\d{5}$/.test(nospace)) return `${nospace.slice(0, 3)} ${nospace.slice(3)}`;
    return raw;
  }
  if (country === "NL") {
    const m = nospace.match(/^(\d{4})([A-Z]{2})$/i);
    if (m) return `${m[1]} ${m[2]!.toUpperCase()}`;
    return raw.toUpperCase().replace(/\s+/g, " ").trim();
  }
  if (country === "LT") {
    const d = nospace.replace(/^LT-?/i, "");
    if (/^\d{5}$/.test(d)) return `LT-${d}`;
    return raw;
  }
  if (country === "LV") {
    const d = nospace.replace(/^LV-?/i, "");
    if (/^\d{4}$/.test(d)) return `LV-${d}`;
    return raw;
  }
  if (country === "IE" && nospace.length === 7) {
    return `${nospace.slice(0, 3)} ${nospace.slice(3)}`.toUpperCase();
  }
  if (
    country &&
    ["DE", "FR", "IT", "ES", "FI", "EE", "UA", "HR", "RO", "BG"].includes(country) &&
    /^\d{5}$/.test(nospace)
  ) {
    return nospace;
  }
  if (
    country &&
    ["AT", "BE", "NO", "CH", "DK", "HU", "SI", "LU"].includes(country) &&
    /^\d{4}$/.test(nospace)
  ) {
    return nospace;
  }
  if (shape === "pl_hyphen") return raw;
  return raw;
}

type Ranked = {
  country: string;
  source: IvoclarCountrySource;
  confidence: IvoclarCountryConfidence;
  rank: number;
};

export function inferIvoclarCountry(input: {
  postal?: string | null;
  city?: string | null;
  nip?: string | null;
  phone?: string | null;
  email?: string | null;
}): IvoclarCountryInference {
  const extracted = extractPostalFromCity(input.city);
  const postalRawIn = String(input.postal ?? "").trim();
  const usedExtracted = !postalRawIn && Boolean(extracted.postal);
  const postalRaw = postalRawIn || extracted.postal || "";
  const city = usedExtracted ? extracted.city : String(input.city ?? "").trim();
  const parsed = classifyPostalShape(postalRaw);
  const uniqueIso = UNIQUE_POSTAL_COUNTRY[parsed.shape] ?? null;
  const cityHit = matchIvoclarCity(city);
  const cityIso = cityHit
    ? cityHit.country ?? disambiguateCityCountries(cityHit.countries, parsed.shape)
    : null;
  const vat = parseVatCountry(input.nip);
  const phoneIso = parsePhoneCountry(input.phone);
  const emailIso = parseEmailCountry(input.email);
  const diaIso =
    parsed.shape === "five_digits" || parsed.shape === "cz_sk_se_spaced"
      ? czSkDiacriticsCountry(city)
      : null;

  const location: Ranked[] = [];
  if (uniqueIso) {
    location.push({ country: uniqueIso, source: "postal_format", confidence: "high", rank: 1 });
  }
  if (cityIso) {
    location.push({ country: cityIso, source: "city", confidence: "high", rank: 1 });
  }

  const locIsos = new Set(location.map((s) => s.country));
  const conflict = locIsos.size > 1;
  let country: string | null = null;
  let source: IvoclarCountrySource | null = null;
  let confidence: IvoclarCountryConfidence | null = null;

  if (!conflict && location.length > 0) {
    const best = location[0]!;
    country = best.country;
    source = best.source;
    confidence = best.confidence;
  }

  if (!country && !conflict) {
    const fallback: Ranked[] = [];
    if (vat?.hasDigits) {
      fallback.push({ country: vat.iso, source: "vat", confidence: "high", rank: 2 });
    }
    if (phoneIso) {
      fallback.push({ country: phoneIso, source: "phone", confidence: "medium", rank: 3 });
    }
    if (emailIso && emailIso !== "PL") {
      fallback.push({ country: emailIso, source: "email", confidence: "medium", rank: 4 });
    }
    if (diaIso) {
      fallback.push({ country: diaIso, source: "diacritics", confidence: "low", rank: 5 });
    }
    if (vat && !vat.hasDigits) {
      fallback.push({ country: vat.iso, source: "vat", confidence: "low", rank: 6 });
    }
    fallback.sort((a, b) => a.rank - b.rank);
    const first = fallback[0];
    if (first) {
      country = first.country;
      source = first.source;
      confidence = first.confidence;
    }
  }

  return {
    country: conflict ? null : country,
    confidence: conflict ? null : confidence,
    source: conflict ? null : source,
    conflict,
    conflictCountries: conflict ? [...locIsos].sort() : [],
    postalShape: parsed.shape,
    postalRaw: parsed.raw,
    postalForFile: formatPostalForCountry(
      conflict ? null : country,
      parsed.shape,
      parsed.shape === "five_digits" ? parsed.compact : parsed.raw
    ),
    cityNormalized: foldCity(city),
    extractedPostalFromCity: usedExtracted ? extracted.postal : null,
  };
}

export const IVOCLAR_COUNTRY_SOURCE_LABELS: Record<IvoclarCountrySource, string> = {
  postal_format: "format kodu",
  city: "miasto",
  vat: "NIP/VAT",
  phone: "telefon",
  email: "e-mail",
  diacritics: "znaki w nazwie miasta",
};
