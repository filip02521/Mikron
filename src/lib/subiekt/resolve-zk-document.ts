import { searchSubiektZk, getSubiektZk } from "@/lib/subiekt/api";
import type { SubiektDocument } from "@/lib/subiekt/types";
import {
  buildZkLineSummary,
  buildZkOrigNote,
  isLikelySubiektDocumentId,
  normalizeZkQuery,
  parseSubiektDocDate,
  pickBestZkMatch,
  resolveZkClientLabel,
  toSubiektAmount,
  zkDocumentStatusLabel,
} from "@/lib/subiekt/zk-document";

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
  origNote: string | null;
  subiektStatus: number | null;
  statusLabel: string | null;
  snapshot: SubiektDocument;
};

export { normalizeZkQuery } from "@/lib/subiekt/zk-document";

function pickKhId(doc: SubiektDocument): number | null {
  const raw = doc.dok_OdbiorcaId ?? doc.dok_PlatnikId;
  if (raw == null) return null;
  const n = Math.trunc(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseDueDate(doc: SubiektDocument): string | null {
  const raw =
    doc.dok_TerminRealizacji ??
    doc.dok_Termin ??
    doc.dok_DataOdbioru ??
    null;
  return parseSubiektDocDate(raw);
}

export function mapZkDocument(doc: SubiektDocument): ResolvedZkDocument {
  const subiektDokId = Math.trunc(Number(doc.dok_Id));
  if (!Number.isFinite(subiektDokId) || subiektDokId <= 0) {
    throw new Error("Nieprawidłowy dokument ZK z Subiekta.");
  }
  const status = doc.dok_Status ?? null;
  const zkNumber = doc.dok_NrPelny?.trim() || `ZK #${subiektDokId}`;
  return {
    subiektDokId,
    zkNumber,
    clientLabel: resolveZkClientLabel(doc),
    clientKhId: pickKhId(doc),
    amountNet: toSubiektAmount(doc.dok_WartNetto),
    amountGross: toSubiektAmount(doc.dok_WartBrutto),
    issuedAt: parseSubiektDocDate(doc.dok_DataWyst),
    dueAt: parseDueDate(doc),
    lineSummary: buildZkLineSummary(doc),
    origNote: buildZkOrigNote(doc),
    subiektStatus: status,
    statusLabel: zkDocumentStatusLabel(status),
    snapshot: doc,
  };
}

/** Wyszukuje ZK po numerze (np. „153157/M/04/2026”) — jeden wynik lub błąd. */
export async function resolveZkByNumber(query: string): Promise<ResolvedZkDocument> {
  const q = normalizeZkQuery(query);
  if (!q) throw new Error("Podaj numer ZK, np. 153157/M/04/2026");

  if (isLikelySubiektDocumentId(q)) {
    try {
      const doc = await getSubiektZk(q);
      return mapZkDocument(doc);
    } catch {
      /* szukaj po numerze */
    }
  }

  const { data } = await searchSubiektZk({ search: q, pageSize: 40 });
  const list = data ?? [];
  const match = pickBestZkMatch(list, q);

  if (match) return loadFullZkDocument(match);

  if (!list.length) {
    throw new Error(`Nie znaleziono ZK „${q}” w Subiekcie.`);
  }

  const serialOnly = /^\d+$/.test(q);
  throw new Error(
    serialOnly
      ? `Znaleziono wiele ZK z numerem ${q} — wpisz pełny numer, np. 153157/M/04/2026.`
      : `Znaleziono ${list.length} dokumentów — wpisz pełny numer ZK, np. 153157/M/04/2026.`
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
