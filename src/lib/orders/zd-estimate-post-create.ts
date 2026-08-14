/**
 * Sesja podsumowania po Utwórz / Powiąż ZD w kreatorze.
 * Snapshot linii przed bumpem otwarteZd — TSV i Link nie zależą od pustej listy Do ZD.
 */

import type { ZdCreatePreviewLine } from "@/lib/orders/zd-estimate-create-zd";

export type ZdPostCreateKind = "created" | "linked" | "timeout_recovery";

export type ZdPostCreateLineSnap = {
  twId: number;
  symbol: string;
  plu: string | null;
  ilosc: number;
  /** Zamrożone przy create — Link history bez zależności od live lines. */
  celAtLink: number;
  deltaAtLink: number;
};

export type ZdPostCreateSession = {
  kind: ZdPostCreateKind;
  supplierId: string;
  supplierName: string;
  fromDaily: boolean;
  dokId: number | null;
  dokNrPelny: string | null;
  lineCount: number;
  snapshotOk: boolean;
  snapshotMessage?: string;
  markIndividualsMessage?: string;
  /** Zamrożone przed bumpem — TSV, mini-lista, Link orderableTwIds. */
  linesSnapshot: ZdPostCreateLineSnap[];
  /** Prefill Link / recover. */
  linkNrPrefill: string | null;
  recentCandidateCount?: number;
  createdAtMs: number;
};

export const ZD_POST_CREATE_PREVIEW_VISIBLE = 8;

export type ZdPostCreateLineMetaInput = {
  twId: number;
  celAtLink?: number | null;
  deltaAtLink?: number | null;
};

export function snapLinesFromCreatePreview(
  lines: readonly ZdCreatePreviewLine[],
  lineMeta?: readonly ZdPostCreateLineMetaInput[] | null
): ZdPostCreateLineSnap[] {
  const metaByTw = new Map<number, ZdPostCreateLineMetaInput>();
  for (const m of lineMeta ?? []) {
    const id = Math.trunc(Number(m.twId));
    if (id > 0) metaByTw.set(id, m);
  }
  return lines.map((l) => {
    const meta = metaByTw.get(l.twId);
    return {
      twId: l.twId,
      symbol: String(l.symbol ?? "").trim() || `tw_${l.twId}`,
      plu: l.plu?.trim() ? l.plu.trim() : null,
      ilosc: Math.max(0, Math.round(Number(l.ilosc) || 0)),
      celAtLink: Math.max(0, Number(meta?.celAtLink) || 0),
      deltaAtLink: Number(meta?.deltaAtLink) || 0,
    };
  });
}

export function buildZdPostCreateSessionFromCreate(input: {
  supplierId: string;
  supplierName: string;
  fromDaily: boolean;
  dokId: number;
  dokNrPelny: string;
  lineCount: number;
  snapshotOk: boolean;
  snapshotMessage?: string;
  markIndividualsMessage?: string;
  previewLines: readonly ZdCreatePreviewLine[];
  lineMeta?: readonly ZdPostCreateLineMetaInput[] | null;
  createdAtMs?: number;
}): ZdPostCreateSession {
  const linesSnapshot = snapLinesFromCreatePreview(
    input.previewLines,
    input.lineMeta
  );
  const dokNr = String(input.dokNrPelny ?? "").trim() || null;
  return {
    kind: "created",
    supplierId: input.supplierId.trim(),
    supplierName: input.supplierName.trim() || "Dostawca",
    fromDaily: input.fromDaily === true,
    dokId: Math.trunc(Number(input.dokId)) || null,
    dokNrPelny: dokNr,
    lineCount: Math.max(0, Math.round(Number(input.lineCount) || linesSnapshot.length)),
    snapshotOk: input.snapshotOk === true,
    snapshotMessage: input.snapshotMessage,
    markIndividualsMessage: input.markIndividualsMessage,
    linesSnapshot,
    linkNrPrefill: input.snapshotOk ? null : dokNr,
    createdAtMs: input.createdAtMs ?? Date.now(),
  };
}

export function buildZdPostCreateSessionFromTimeout(input: {
  supplierId: string;
  supplierName: string;
  fromDaily: boolean;
  previewLines?: readonly ZdCreatePreviewLine[] | null;
  lineMeta?: readonly ZdPostCreateLineMetaInput[] | null;
  createdAtMs?: number;
}): ZdPostCreateSession {
  const linesSnapshot = snapLinesFromCreatePreview(
    input.previewLines ?? [],
    input.lineMeta
  );
  return {
    kind: "timeout_recovery",
    supplierId: input.supplierId.trim(),
    supplierName: input.supplierName.trim() || "Dostawca",
    fromDaily: input.fromDaily === true,
    dokId: null,
    dokNrPelny: null,
    lineCount: linesSnapshot.length,
    snapshotOk: false,
    linesSnapshot,
    linkNrPrefill: null,
    createdAtMs: input.createdAtMs ?? Date.now(),
  };
}

export function buildZdPostCreateSessionFromLink(input: {
  supplierId: string;
  supplierName: string;
  fromDaily: boolean;
  dokId: number | null;
  dokNrPelny: string;
  lineCount: number;
  /** Zachowaj snap z create, gdy Link domyka historię. */
  previous?: ZdPostCreateSession | null;
  /** Gdy brak previous snap (ręczne Powiąż) — zamroź live preview. */
  previewLines?: readonly ZdCreatePreviewLine[] | null;
  lineMeta?: readonly ZdPostCreateLineMetaInput[] | null;
  createdAtMs?: number;
}): ZdPostCreateSession {
  const prev = input.previous;
  const dokNr = String(input.dokNrPelny ?? "").trim() || null;
  const dokIdRaw = Math.trunc(Number(input.dokId));
  const fromPrev = prev?.linesSnapshot?.length ? prev.linesSnapshot : null;
  const fromLive =
    !fromPrev && input.previewLines?.length
      ? snapLinesFromCreatePreview(input.previewLines, input.lineMeta)
      : null;
  const linesSnapshot = fromPrev ?? fromLive ?? [];
  return {
    kind: "linked",
    supplierId: (input.supplierId || prev?.supplierId || "").trim(),
    supplierName:
      (input.supplierName || prev?.supplierName || "").trim() || "Dostawca",
    fromDaily: input.fromDaily === true || prev?.fromDaily === true,
    dokId: dokIdRaw > 0 ? dokIdRaw : prev?.dokId ?? null,
    dokNrPelny: dokNr,
    lineCount: Math.max(
      0,
      Math.round(
        Number(input.lineCount) ||
          prev?.lineCount ||
          linesSnapshot.length ||
          0
      )
    ),
    snapshotOk: true,
    markIndividualsMessage: prev?.markIndividualsMessage,
    linesSnapshot,
    linkNrPrefill: null,
    recentCandidateCount: prev?.recentCandidateCount,
    createdAtMs: input.createdAtMs ?? Date.now(),
  };
}

export function patchZdPostCreateTimeoutCandidates(
  session: ZdPostCreateSession,
  input: { linkNrPrefill: string | null; recentCandidateCount: number }
): ZdPostCreateSession {
  if (session.kind !== "timeout_recovery") return session;
  return {
    ...session,
    linkNrPrefill: input.linkNrPrefill?.trim() || null,
    recentCandidateCount: Math.max(0, Math.round(input.recentCandidateCount)),
  };
}

export function postCreateNeedsHistoryLink(session: ZdPostCreateSession): boolean {
  if (session.kind === "timeout_recovery") return true;
  return !session.snapshotOk;
}

export function postCreateOrderableTwIds(
  session: ZdPostCreateSession | null | undefined
): number[] | null {
  if (!session?.linesSnapshot.length) return null;
  return session.linesSnapshot.map((l) => l.twId).filter((id) => id > 0);
}

export function postCreateLinkLineMeta(
  session: ZdPostCreateSession | null | undefined
): { twId: number; celAtLink: number; deltaAtLink: number }[] | null {
  if (!session?.linesSnapshot.length) return null;
  return session.linesSnapshot.map((l) => ({
    twId: l.twId,
    celAtLink: l.celAtLink,
    deltaAtLink: l.deltaAtLink,
  }));
}

/** Prosty TSV ze snapshota create (nie wymaga pełnych ManualZdEstimateLine). */
export function postCreateLinesSnapshotToTsv(
  lines: readonly ZdPostCreateLineSnap[]
): string {
  const header = ["symbol", "plu", "do_zd", "tw_Id"].join("\t");
  const rows = lines.map((l) =>
    [l.symbol, l.plu ?? "", l.ilosc, l.twId].join("\t")
  );
  return [header, ...rows].join("\n");
}

export function buildZdSupplierMailto(input: {
  email: string;
  dokNr: string | null;
  supplierName: string;
  lineCount: number;
  dateKey: string;
}): { href: string; subject: string; body: string } | null {
  const email = String(input.email ?? "")
    .replace(/^mailto:/i, "")
    .trim();
  if (!email || !email.includes("@")) return null;
  const dok = String(input.dokNr ?? "").trim();
  const name = String(input.supplierName ?? "").trim() || "Dostawca";
  const n = Math.max(0, Math.round(Number(input.lineCount) || 0));
  const dateKey = String(input.dateKey ?? "").trim();
  const subject = dok
    ? `ZD ${dok} — ${name}`
    : `Zamówienie ZD — ${name}`;
  const bodyLines = [
    dok ? `Numer ZD: ${dok}` : "Numer ZD: (do potwierdzenia w Subiekcie)",
    `Dostawca: ${name}`,
    `Pozycji: ${n}`,
    dateKey ? `Data: ${dateKey}` : null,
    "",
    "Proszę o potwierdzenie przyjęcia zamówienia.",
  ].filter((x): x is string => x != null);
  const body = bodyLines.join("\n");
  const href = buildMailtoHref({ email, subject, body });
  if (!href) return null;
  return { href, subject, body };
}

/** Składa mailto z dowolnym subject/body (composer ręczny). */
export function buildMailtoHref(input: {
  email: string;
  subject: string;
  body: string;
}): string | null {
  const email = String(input.email ?? "")
    .replace(/^mailto:/i, "")
    .trim();
  if (!email || !email.includes("@")) return null;
  const subject = String(input.subject ?? "");
  const body = String(input.body ?? "");
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Czyści flagi review qty po zmianie cover (create bump / parent BOM). */
export function clearSalesTrackQtyReviewMeta<
  T extends {
    salesTrackQtyReview?: boolean;
    salesTrackHeldExtraQty?: number;
    salesTrackAllowedExtraQty?: number;
    salesTrackReasons?: readonly string[];
  },
>(line: T): T {
  const reasons = (line.salesTrackReasons ?? []).filter(
    (r) => r !== "boost_held" && r !== "boost_scaled"
  );
  return {
    ...line,
    salesTrackQtyReview: false,
    salesTrackHeldExtraQty: 0,
    salesTrackAllowedExtraQty: 0,
    salesTrackReasons: reasons as T["salesTrackReasons"],
  };
}
