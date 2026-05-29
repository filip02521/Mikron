import { searchSubiektZk, getSubiektZk } from "@/lib/subiekt/api";
import {
  extractAnyKhLabelFromDocument,
  extractKhLabelFromDocument,
} from "@/lib/subiekt/kontrahent-from-document";
import type { SubiektDocument } from "@/lib/subiekt/types";

export type ResolvedZkDocument = {
  subiektDokId: number;
  zkNumber: string;
  clientLabel: string;
  clientKhId: number | null;
  amountNet: number | null;
  amountGross: number | null;
  issuedAt: string | null;
  dueAt: string | null;
  lineSummary: string | null;
  snapshot: SubiektDocument;
};

/** Usuwa prefiks ZK i zbędne spacje z wpisu handlowca. */
export function normalizeZkQuery(input: string): string {
  return input
    .trim()
    .replace(/^zk\s*[:#]?\s*/i, "")
    .trim();
}

function normalizeDocNumber(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function pickKhId(doc: SubiektDocument): number | null {
  const raw = doc.dok_OdbiorcaId ?? doc.dok_PlatnikId;
  if (raw == null) return null;
  const n = Math.trunc(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function resolveClientLabel(doc: SubiektDocument): string {
  const khId = pickKhId(doc);
  if (khId != null) {
    const labeled = extractKhLabelFromDocument(doc, khId);
    if (labeled?.trim()) return labeled.trim();
  }
  const any = extractAnyKhLabelFromDocument(doc);
  if (any?.trim()) return any.trim();
  return "Klient z Subiekta";
}

function parseDocDate(doc: SubiektDocument): string | null {
  const raw =
    doc.dok_DataWyst ??
    doc.dok_DataRealizacji ??
    doc.dok_TerminRealizacji ??
    doc.dok_Termin ??
    null;
  if (!raw || typeof raw !== "string") return null;
  return raw.slice(0, 10);
}

function parseDueDate(doc: SubiektDocument): string | null {
  const raw =
    doc.dok_TerminRealizacji ??
    doc.dok_Termin ??
    doc.dok_DataOdbioru ??
    null;
  if (!raw || typeof raw !== "string") return null;
  return raw.slice(0, 10);
}

function toAmount(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildLineSummary(doc: SubiektDocument): string | null {
  const lines = doc.dok_Pozycja ?? [];
  if (!lines.length) return null;
  const names = lines
    .map((l) => l.tw_Nazwa?.trim() || l.tw_Symbol?.trim())
    .filter((n): n is string => Boolean(n));
  if (!names.length) return `${lines.length} poz.`;
  if (names.length === 1) return names[0]!;
  return `${names[0]} · +${names.length - 1} poz.`;
}

export function mapZkDocument(doc: SubiektDocument): ResolvedZkDocument {
  const subiektDokId = Math.trunc(Number(doc.dok_Id));
  if (!Number.isFinite(subiektDokId) || subiektDokId <= 0) {
    throw new Error("Nieprawidłowy dokument ZK z Subiekta.");
  }
  const zkNumber = doc.dok_NrPelny?.trim() || `ZK #${subiektDokId}`;
  return {
    subiektDokId,
    zkNumber,
    clientLabel: resolveClientLabel(doc),
    clientKhId: pickKhId(doc),
    amountNet: toAmount(doc.dok_WartNetto),
    amountGross: toAmount(doc.dok_WartBrutto),
    issuedAt: parseDocDate(doc),
    dueAt: parseDueDate(doc),
    lineSummary: buildLineSummary(doc),
    snapshot: doc,
  };
}

/** Wyszukuje ZK po numerze (np. „145/2026”) — jeden wynik lub błąd. */
export async function resolveZkByNumber(query: string): Promise<ResolvedZkDocument> {
  const q = normalizeZkQuery(query);
  if (!q) throw new Error("Podaj numer ZK, np. 145/2026");

  if (/^\d+$/.test(q)) {
    try {
      const doc = await getSubiektZk(q);
      return mapZkDocument(doc);
    } catch {
      /* szukaj po numerze */
    }
  }

  const { data } = await searchSubiektZk({ search: q, pageSize: 25 });
  const list = data ?? [];
  const needle = normalizeDocNumber(q);

  const exact = list.find((d) => {
    const nr = d.dok_NrPelny?.trim();
    if (!nr) return false;
    return normalizeDocNumber(nr) === needle;
  });
  if (exact) return loadFullZkDocument(exact);

  if (list.length === 1) return loadFullZkDocument(list[0]!);

  if (!list.length) {
    throw new Error(`Nie znaleziono ZK „${q}” w Subiekcie.`);
  }

  throw new Error(
    `Znaleziono ${list.length} dokumentów — wpisz pełny numer ZK, np. 145/2026.`
  );
}

/** Lista ZK bywa bez embedów — pobieramy pełny dokument po dok_Id. */
async function loadFullZkDocument(doc: SubiektDocument): Promise<ResolvedZkDocument> {
  const id = Math.trunc(Number(doc.dok_Id));
  if (Number.isFinite(id) && id > 0) {
    try {
      const full = await getSubiektZk(id);
      return mapZkDocument(full);
    } catch {
      /* fallback na wynik wyszukiwania */
    }
  }
  return mapZkDocument(doc);
}
