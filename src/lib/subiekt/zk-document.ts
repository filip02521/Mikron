import type { SubiektDocument, SubiektKontrahent } from "@/lib/subiekt/types";

/** Usuwa prefiks ZK i zbędne spacje z wpisu handlowca. */
export function normalizeZkQuery(input: string): string {
  return input
    .trim()
    .replace(/^zk\s*[:#]?\s*/i, "")
    .trim();
}

/** Klucz porównawczy numeru ZK (bez spacji, lowercase, bez prefiksu ZK). */
export function normalizeZkNumberKey(value: string): string {
  return value
    .trim()
    .replace(/^zk\s*/i, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/** Numer seryjny z „ZK 153159/M/04/2026” → 153159. */
export function extractZkSerial(dokNrPelny: string): string | null {
  const m = dokNrPelny.match(/(\d+)\/M\//i);
  return m?.[1] ?? null;
}

/** Suffix magazyn/miesiąc/rok: /m/04/2026. */
export function extractZkPathSuffix(dokNrPelny: string): string | null {
  const m = dokNrPelny.match(/(\/M\/\d+\/\d{4})/i);
  return m?.[1]?.replace(/\s+/g, "").toLowerCase() ?? null;
}

export function cleanSubiektText(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\r\n/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || null;
}

/** Etykieta klienta pod notatnik — krótko, czytelnie dla handlowca. */
export function formatZkKontrahentLabel(k: SubiektKontrahent): string {
  const shortName = cleanSubiektText(k.adr_Nazwa);
  const fullName = cleanSubiektText(k.adr_NazwaPelna);
  const symbol = cleanSubiektText(k.kh_Symbol);
  const city = cleanSubiektText(k.adr_Miejscowosc);

  const primary = shortName || fullName || symbol || "Klient z Subiekta";

  if (symbol && symbol !== primary && !primary.toLowerCase().includes(symbol.toLowerCase())) {
    return city ? `${primary} (${symbol}, ${city})` : `${primary} (${symbol})`;
  }
  if (city && !primary.toLowerCase().includes(city.toLowerCase())) {
    return `${primary} · ${city}`;
  }
  return primary;
}

/** Status dokumentu ZK w Subiekcie (typ 16) — obserwowane wartości z produkcji. */
export function zkDocumentStatusLabel(status: number | null | undefined): string | null {
  if (status == null) return null;
  switch (status) {
    case 6:
      return "Oferta";
    case 7:
      return "Aktywne";
    case 8:
      return "Zrealizowane";
    default:
      return `Status ${status}`;
  }
}

/** dok_Id w Subiekcie (np. 1782112) — nie mylić z numerem seryjnym ZK (153159). */
export function isLikelySubiektDocumentId(query: string): boolean {
  if (!/^\d+$/.test(query)) return false;
  const n = Number(query);
  return Number.isFinite(n) && n >= 1_000_000;
}

export function zkNumbersEquivalent(a: string, b: string): boolean {
  const ka = normalizeZkNumberKey(a);
  const kb = normalizeZkNumberKey(b);
  if (ka === kb) return true;

  const serialA = extractZkSerial(a);
  const serialB = extractZkSerial(b);
  const pathA = extractZkPathSuffix(a);
  const pathB = extractZkPathSuffix(b);

  if (serialA && serialB && serialA === serialB) {
    if (pathA && pathB) return pathA === pathB;
    if (!pathA || !pathB) return true;
  }

  if (/^\d+$/.test(kb) && serialA === kb) {
    return true;
  }

  return false;
}

export function pickBestZkMatch(
  list: SubiektDocument[],
  query: string
): SubiektDocument | null {
  if (!list.length) return null;

  const q = normalizeZkQuery(query);
  const needle = normalizeZkNumberKey(q);

  const fullMatches = list.filter((d) => {
    const nr = d.dok_NrPelny?.trim();
    return nr && normalizeZkNumberKey(nr) === needle;
  });
  if (fullMatches.length === 1) return fullMatches[0]!;
  if (fullMatches.length > 1) return null;

  const serialQ = /^\d+$/.test(q) ? q : extractZkSerial(q);
  if (serialQ) {
    const serialMatches = list.filter((d) => extractZkSerial(d.dok_NrPelny ?? "") === serialQ);
    if (serialMatches.length === 1) return serialMatches[0]!;
    return null;
  }

  if (list.length === 1) return list[0]!;
  return null;
}

export function buildZkOrigNote(doc: SubiektDocument): string | null {
  return cleanSubiektText(doc.dok_NrPelnyOryg);
}

export function buildZkLineSummary(doc: SubiektDocument): string | null {
  const lines = doc.dok_Pozycja ?? [];
  if (lines.length) {
    const names = lines
      .map((l) => l.tw_Nazwa?.trim() || l.tw_Symbol?.trim())
      .filter((n): n is string => Boolean(n));
    if (!names.length) return `${lines.length} poz.`;
    if (names.length === 1) return names[0]!;
    return `${names[0]} · +${names.length - 1} poz.`;
  }
  const orig = buildZkOrigNote(doc);
  if (orig) return orig;
  const status = zkDocumentStatusLabel(doc.dok_Status ?? null);
  return status ? `Subiekt: ${status}` : null;
}

export function pickKhIdFromDocument(doc: SubiektDocument): number | null {
  const raw = doc.dok_OdbiorcaId ?? doc.dok_PlatnikId;
  if (raw == null) return null;
  const n = Math.trunc(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function resolveZkClientLabel(doc: SubiektDocument): string {
  const khId = pickKhIdFromDocument(doc);
  const targetId = khId != null ? Math.trunc(khId) : null;

  const blocks = [doc.kh__Kontrahent_Odbiorca, doc.kh__Kontrahent_Platnik].filter(
    (k): k is SubiektKontrahent => k != null
  );

  if (targetId != null) {
    for (const k of blocks) {
      if (Math.trunc(Number(k.kh_Id)) === targetId) {
        const label = formatZkKontrahentLabel(k);
        if (label.trim()) return label;
      }
    }
  }

  for (const k of blocks) {
    const label = formatZkKontrahentLabel(k);
    if (label.trim()) return label;
  }

  return targetId ? `Kontrahent #${targetId}` : "Klient z Subiekta";
}

export function parseSubiektDocDate(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  return raw.slice(0, 10);
}

export function toSubiektAmount(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
