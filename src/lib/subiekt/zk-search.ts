import { endOfMonth, startOfMonth, subDays } from "date-fns";
import type { SubiektDocument } from "@/lib/subiekt/types";
import { formatDateString } from "@/lib/orders/dates";
import {
  buildZkLineSummary,
  extractZkSerial,
  isFullZkNumberQuery,
  isLikelySubiektDocumentId,
  normalizeZkNumberKey,
  normalizeZkQuery,
  parseSubiektDocDate,
  resolveZkClientLabel,
  zkNumbersEquivalent,
} from "@/lib/subiekt/zk-document";

export const ZK_RECENT_SEARCH_DAYS = 30;
export const MIN_ZK_QUERY_LENGTH = 2;

const MONTHS_PL = [
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień",
] as const;

export type ZkSearchScope =
  | { mode: "document_id" }
  | { mode: "month"; dataOd: string; dataDo: string; monthLabel: string }
  | { mode: "recent"; dataOd: string; dataDo: string; days: number };

export type ZkSearchCandidate = {
  subiektDokId: number;
  zkNumber: string;
  clientLabel: string;
  issuedAt: string | null;
  lineSummary: string | null;
};

export type ZkQueryValidation =
  | { ok: true; normalized: string }
  | { ok: false; message: string };

/** Walidacja wpisu przed wyszukiwaniem ZK. */
export function validateZkQueryForSubmit(input: string): ZkQueryValidation {
  const normalized = normalizeZkQuery(input);
  if (!normalized) {
    return {
      ok: false,
      message: "Podaj numer ZK (min. 2 znaki), np. 234/M/03/2026.",
    };
  }
  if (normalized.replace(/\s+/g, "").length < MIN_ZK_QUERY_LENGTH) {
    return { ok: false, message: "Wpisz co najmniej 2 znaki numeru ZK." };
  }
  return { ok: true, normalized };
}

/** Zakres kalendarzowy miesiąca z pełnego numeru (234/M/03/2026 → marzec 2026). */
export function zkMonthRangeFromFullNumber(query: string): {
  dataOd: string;
  dataDo: string;
  month: number;
  year: number;
} | null {
  const compact = normalizeZkQuery(query).replace(/\s+/g, "");
  const m = compact.match(/^(\d+)\/M\/(\d{1,2})\/(\d{4})$/i);
  if (!m) return null;

  const month = Number(m[2]);
  const year = Number(m[3]);
  if (!Number.isFinite(month) || month < 1 || month > 12 || !Number.isFinite(year)) {
    return null;
  }

  const anchor = new Date(year, month - 1, 1);
  return {
    month,
    year,
    dataOd: formatDateString(startOfMonth(anchor)),
    dataDo: formatDateString(endOfMonth(anchor)),
  };
}

export function formatZkMonthLabel(year: number, month: number): string {
  const name = MONTHS_PL[month - 1] ?? `miesiąc ${month}`;
  return `${name} ${year}`;
}

/** Ostatnie N dni kalendarzowych (domyślnie 30). */
export function zkRecentDaysRange(
  days = ZK_RECENT_SEARCH_DAYS,
  at: Date = new Date()
): { dataOd: string; dataDo: string } {
  return {
    dataOd: formatDateString(subDays(at, days)),
    dataDo: formatDateString(at),
  };
}

/** Strategia wyszukiwania: pełny numer → miesiąc z kodu; krótki → ostatnie 30 dni. */
export function resolveZkSearchScope(query: string, at: Date = new Date()): ZkSearchScope {
  const compact = normalizeZkQuery(query).replace(/\s+/g, "");

  if (isLikelySubiektDocumentId(compact)) {
    return { mode: "document_id" };
  }

  if (isFullZkNumberQuery(query)) {
    const monthRange = zkMonthRangeFromFullNumber(query);
    if (monthRange) {
      return {
        mode: "month",
        dataOd: monthRange.dataOd,
        dataDo: monthRange.dataDo,
        monthLabel: formatZkMonthLabel(monthRange.year, monthRange.month),
      };
    }
  }

  const recent = zkRecentDaysRange(ZK_RECENT_SEARCH_DAYS, at);
  return {
    mode: "recent",
    dataOd: recent.dataOd,
    dataDo: recent.dataDo,
    days: ZK_RECENT_SEARCH_DAYS,
  };
}

/** Fraza przekazywana do GET /documents/zk?search= */
export function extractZkSearchToken(query: string): string {
  const compact = normalizeZkQuery(query).replace(/\s+/g, "");
  if (isFullZkNumberQuery(compact)) {
    return extractZkSerial(`ZK ${compact}`) ?? compact.split("/")[0] ?? compact;
  }
  const leadingDigits = compact.match(/^(\d+)/)?.[1];
  if (leadingDigits) return leadingDigits;
  return compact;
}

export function documentMatchesZkQuery(doc: SubiektDocument, query: string): boolean {
  const nr = doc.dok_NrPelny?.trim();
  if (!nr) return false;

  const q = normalizeZkQuery(query);
  const compact = q.replace(/\s+/g, "");

  if (isFullZkNumberQuery(compact)) {
    return zkNumbersEquivalent(nr, compact) || zkNumbersEquivalent(nr, q);
  }

  // Częściowy numer z /M/ (np. 234/M/03) — dopasowanie po kluczu ścieżki.
  if (/\/M\//i.test(compact)) {
    const qKey = normalizeZkNumberKey(compact);
    const nrKey = normalizeZkNumberKey(nr);
    if (qKey && (nrKey === qKey || nrKey.startsWith(qKey))) return true;
    return false;
  }

  // Krótki wpis cyfrowy — tylko prefiks numeru seryjnego (nie miesiąc/rok z /M/…).
  if (/^\d+$/.test(compact)) {
    const serial = extractZkSerial(nr);
    if (!serial) return false;
    return serial === compact || serial.startsWith(compact);
  }

  return nr.toLowerCase().includes(q.toLowerCase());
}

export function collectMatchingZkDocuments(
  list: SubiektDocument[],
  query: string
): SubiektDocument[] {
  const byId = new Map<number, SubiektDocument>();
  for (const doc of list) {
    if (!documentMatchesZkQuery(doc, query)) continue;
    const id = Math.trunc(Number(doc.dok_Id));
    if (!Number.isFinite(id) || id <= 0) continue;
    byId.set(id, doc);
  }

  return [...byId.values()].sort((a, b) => {
    const da = parseSubiektDocDate(a.dok_DataWyst) ?? "";
    const db = parseSubiektDocDate(b.dok_DataWyst) ?? "";
    return db.localeCompare(da) || Number(b.dok_Id) - Number(a.dok_Id);
  });
}

export function toZkSearchCandidate(doc: SubiektDocument): ZkSearchCandidate {
  const subiektDokId = Math.trunc(Number(doc.dok_Id));
  return {
    subiektDokId,
    zkNumber: doc.dok_NrPelny?.trim() || `ZK #${subiektDokId}`,
    clientLabel: resolveZkClientLabel(doc),
    issuedAt: parseSubiektDocDate(doc.dok_DataWyst),
    lineSummary: buildZkLineSummary(doc),
  };
}

export function zkSearchNotFoundMessage(query: string, scope: ZkSearchScope): string {
  const q = normalizeZkQuery(query);
  if (scope.mode === "month") {
    return `Nie znaleziono ZK „${q}” w ${scope.monthLabel}.`;
  }
  if (scope.mode === "recent") {
    return `Nie znaleziono ZK „${q}” z ostatnich ${scope.days} dni.`;
  }
  return `Nie znaleziono ZK „${q}” w Subiekcie.`;
}

export function zkSearchChooseHint(query: string, scope: ZkSearchScope, count: number): string {
  const q = normalizeZkQuery(query);
  if (scope.mode === "month") {
    return `W ${scope.monthLabel} znaleziono ${count} ZK pasujących do „${q}” — wybierz właściwe.`;
  }
  if (scope.mode === "recent") {
    return `Z ostatnich ${scope.days} dni znaleziono ${count} ZK pasujących do „${q}” — wybierz właściwe.`;
  }
  return `Znaleziono ${count} ZK pasujących do „${q}” — wybierz właściwe.`;
}
