import { searchSubiektZk, getSubiektZk } from "@/lib/subiekt/api";
import { feedbackFromException } from "@/lib/subiekt/feedback";
import type { SubiektDocument } from "@/lib/subiekt/types";
import {
  buildZkLineSummary,
  buildZkOrigNote,
  normalizeZkQuery,
  parseSubiektDocDate,
  resolveZkClientLabel,
  toSubiektAmount,
  zkDocumentStatusLabel,
} from "@/lib/subiekt/zk-document";
import {
  collectMatchingZkDocuments,
  extractZkSearchToken,
  resolveZkSearchScope,
  toZkSearchCandidate,
  validateZkQueryForSubmit,
  zkSearchChooseHint,
  zkSearchNotFoundMessage,
  type ZkSearchCandidate,
} from "@/lib/subiekt/zk-search";

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

export type ZkAddSearchResult =
  | { kind: "single"; resolved: ResolvedZkDocument }
  | { kind: "choose"; candidates: ZkSearchCandidate[]; hint: string }
  | { kind: "error"; message: string };

export { normalizeZkQuery } from "@/lib/subiekt/zk-document";
export type { ZkSearchCandidate } from "@/lib/subiekt/zk-search";

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

/** Wyszukuje ZK do dodania — 1 wynik, lista wyboru lub błąd. */
export async function searchZkForAdd(
  query: string,
  at: Date = new Date()
): Promise<ZkAddSearchResult> {
  const validated = validateZkQueryForSubmit(query);
  if (!validated.ok) return { kind: "error", message: validated.message };

  const q = validated.normalized;
  const scope = resolveZkSearchScope(q, at);

  if (scope.mode === "document_id") {
    try {
      const doc = await getSubiektZk(q);
      return { kind: "single", resolved: mapZkDocument(doc) };
    } catch (e) {
      return { kind: "error", message: feedbackFromException(e).message };
    }
  }

  let list: SubiektDocument[] = [];
  try {
    const { data } = await searchSubiektZk({
      search: extractZkSearchToken(q),
      dataOd: scope.dataOd,
      dataDo: scope.dataDo,
      pageSize: 40,
    });
    list = data ?? [];
  } catch (e) {
    return { kind: "error", message: feedbackFromException(e).message };
  }

  const matches = collectMatchingZkDocuments(list, q);
  if (!matches.length) {
    return { kind: "error", message: zkSearchNotFoundMessage(q, scope) };
  }

  if (matches.length === 1) {
    return { kind: "single", resolved: await loadFullZkDocument(matches[0]!) };
  }

  return {
    kind: "choose",
    candidates: matches.map(toZkSearchCandidate),
    hint: zkSearchChooseHint(q, scope, matches.length),
  };
}

/** Wyszukuje ZK po numerze — dokładnie jeden wynik lub błąd (bez wyboru). */
export async function resolveZkByNumber(query: string): Promise<ResolvedZkDocument> {
  const result = await searchZkForAdd(query);
  if (result.kind === "error") throw new Error(result.message);
  if (result.kind === "choose") {
    throw new Error(result.hint);
  }
  return result.resolved;
}

export async function resolveZkBySubiektDokId(
  subiektDokId: number
): Promise<ResolvedZkDocument> {
  const id = Math.trunc(subiektDokId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Nieprawidłowy identyfikator ZK.");
  }
  const doc = await getSubiektZk(id);
  return loadFullZkDocument(doc);
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
