/**
 * Sesja podsumowania po Utwórz / Powiąż ZD w kreatorze.
 * Snapshot linii przed bumpem otwarteZd — TSV i Link nie zależą od pustej listy Do ZD.
 */

import type { ZdCreatePreviewLine } from "@/lib/orders/zd-estimate-create-zd";
import type {
  ZdEstimateIndividualServiceLine,
  ZdEstimateIndividualServiceReason,
  ZdEstimateIndividualTwExtra,
  ZdEstimatePendingIndividualOrder,
} from "@/lib/orders/zd-estimate-individual";
import { piecesArrivingForZdUnits } from "@/lib/orders/zd-estimate-packaging";

export type ZdPostCreateKind = "created" | "linked" | "timeout_recovery";

export type ZdPostCreateLineSnap = {
  twId: number;
  symbol: string;
  nazwa: string;
  plu: string | null;
  ilosc: number;
  packagingHint: string | null;
  individualExtraPieces: number;
  extraOnly: boolean;
  piecesArriving: number | null;
  unitsPerPackage: number | null;
  documentUnitMode: "packages" | "pieces_multiple" | null;
  roundupNeed: number | null;
  roundupArrive: number | null;
  bomOrPairLabel: string | null;
  /** Zamrożone przy create — Link history bez zależności od live lines. */
  celAtLink: number;
  deltaAtLink: number;
};

export type ZdPostCreateRequestSnap = {
  orderId: string;
  salesPersonName: string;
  qty: number;
  symbol: string | null;
  products: string;
  requestNote: string | null;
};

export type ZdPostCreateServiceSnap = {
  key: string;
  label: string;
  qty: number;
  reason: ZdEstimateIndividualServiceReason;
  requests: ZdPostCreateRequestSnap[];
};

export type ZdPostCreateBumpedLine = {
  twId: number;
  from: number;
  to: number;
  extraPieces: number;
};

export type ZdPostCreateMarkFreeze = {
  pendingGlowneCatalogIds: string[];
  pendingGlowneServiceIds: string[];
  consumedOrderIds: string[];
  catalogRequests: ZdPostCreateRequestSnap[];
  serviceLines: ZdPostCreateServiceSnap[];
  teethServiceCount: number;
  omittedServiceCount: number;
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
  /** Zamrożone przed bumpem otwarteZd — TSV, lista, Link orderableTwIds. */
  linesSnapshot: ZdPostCreateLineSnap[];
  markFreeze: ZdPostCreateMarkFreeze;
  bumped: ZdPostCreateBumpedLine[];
  composedUwagi: string | null;
  glowneDone: boolean;
  glowneMarkedIds: string[];
  scheduleDone: boolean;
  /** Prefill Link / recover. */
  linkNrPrefill: string | null;
  recentCandidateCount?: number;
  createdAtMs: number;
};

export type ZdPostCreateLineMetaInput = {
  twId: number;
  celAtLink?: number | null;
  deltaAtLink?: number | null;
};

export function emptyZdPostCreateMarkFreeze(): ZdPostCreateMarkFreeze {
  return {
    pendingGlowneCatalogIds: [],
    pendingGlowneServiceIds: [],
    consumedOrderIds: [],
    catalogRequests: [],
    serviceLines: [],
    teethServiceCount: 0,
    omittedServiceCount: 0,
  };
}

function requestSnapFromRef(input: {
  orderId: string;
  salesPersonName: string;
  qty: number;
  symbol: string | null;
  products: string;
  requestNote: string | null;
}): ZdPostCreateRequestSnap {
  return {
    orderId: String(input.orderId ?? "").trim(),
    salesPersonName: String(input.salesPersonName ?? "").trim() || "Handlowiec",
    qty: Math.max(0, Number(input.qty) || 0),
    symbol: input.symbol?.trim() ? input.symbol.trim() : null,
    products: String(input.products ?? "").trim(),
    requestNote: input.requestNote?.trim() ? input.requestNote.trim() : null,
  };
}

export function buildZdPostCreateMarkFreeze(input: {
  catalogOrderIds: readonly string[];
  includedServiceOrderIds: readonly string[];
  omittedServiceCount?: number;
  serviceLines: readonly ZdEstimateIndividualServiceLine[];
  catalogByTwId: ReadonlyMap<number, ZdEstimateIndividualTwExtra>;
}): ZdPostCreateMarkFreeze {
  const catalogIds = [
    ...new Set(
      input.catalogOrderIds.map((id) => String(id ?? "").trim()).filter(Boolean)
    ),
  ];
  const catalogSet = new Set(catalogIds);
  const teethIds = new Set<string>();
  const serviceSnaps: ZdPostCreateServiceSnap[] = input.serviceLines.map(
    (line) => {
      const requests = line.requests.map((r) => requestSnapFromRef(r));
      if (line.reason === "teeth") {
        for (const r of requests) teethIds.add(r.orderId);
      }
      return {
        key: line.key,
        label: line.label,
        qty: line.qty,
        reason: line.reason,
        requests,
      };
    }
  );
  const includedRaw = [
    ...new Set(
      input.includedServiceOrderIds
        .map((id) => String(id ?? "").trim())
        .filter(Boolean)
    ),
  ];
  // Zęby: w uwagach / consume tylko gdy faktycznie weszły (included); nie Główne.
  const includedTeethIds = includedRaw.filter((id) => teethIds.has(id));
  const includedServiceIds = includedRaw.filter((id) => !teethIds.has(id));
  const catalogRequests: ZdPostCreateRequestSnap[] = [];
  const seenCatalog = new Set<string>();
  for (const extra of input.catalogByTwId.values()) {
    for (const r of extra.requests) {
      if (!catalogSet.has(r.orderId) || seenCatalog.has(r.orderId)) continue;
      seenCatalog.add(r.orderId);
      catalogRequests.push(requestSnapFromRef(r));
    }
  }
  const consumed = [
    ...new Set([...catalogIds, ...includedServiceIds, ...includedTeethIds]),
  ];
  return {
    pendingGlowneCatalogIds: catalogIds,
    pendingGlowneServiceIds: includedServiceIds,
    consumedOrderIds: consumed,
    catalogRequests,
    serviceLines: serviceSnaps,
    teethServiceCount: includedTeethIds.length,
    omittedServiceCount: Math.max(0, Math.trunc(input.omittedServiceCount ?? 0)),
  };
}

/** Merge liczników po create: serwer często zwraca 0 po pre-filter usług — nie nadpisuj ostrzeżenia klienta. */
export function mergePostCreateServiceCounts(
  freeze: Pick<ZdPostCreateMarkFreeze, "omittedServiceCount" | "teethServiceCount">,
  server?: {
    omittedServiceCount?: number | null;
    teethServiceCount?: number | null;
  }
): Pick<ZdPostCreateMarkFreeze, "omittedServiceCount" | "teethServiceCount"> {
  const serverOmitted = Math.max(
    0,
    Math.trunc(Number(server?.omittedServiceCount) || 0)
  );
  const serverTeeth = Math.max(
    0,
    Math.trunc(Number(server?.teethServiceCount) || 0)
  );
  return {
    omittedServiceCount: Math.max(freeze.omittedServiceCount, serverOmitted),
    teethServiceCount: Math.max(freeze.teethServiceCount, serverTeeth),
  };
}

export function pendingGlowneOrderIds(
  freeze: ZdPostCreateMarkFreeze | null | undefined
): string[] {
  if (!freeze) return [];
  return [
    ...new Set([
      ...freeze.pendingGlowneCatalogIds,
      ...freeze.pendingGlowneServiceIds,
    ]),
  ];
}

/**
 * Consume z sesji post-create tylko gdy dokument jest potwierdzony.
 * timeout_recovery ma markFreeze.consumedOrderIds do CTA po linku, ale NIE wolno
 * wycinać extras z listy / drugiego Create (false timeout → under-order).
 */
export function confirmedPostCreateConsumedOrderIds(
  session: ZdPostCreateSession | null | undefined
): string[] {
  if (!session) return [];
  if (session.kind === "timeout_recovery") return [];
  const dokId = session.dokId != null ? Math.trunc(Number(session.dokId)) : 0;
  if (!(dokId > 0)) return [];
  return session.markFreeze.consumedOrderIds ?? [];
}

/**
 * Po Główne: odejmij processed (+ opcjonalnie durable skips) od pending;
 * glowneDone gdy pusto. incomplete zostają w pending (retry).
 */
export function applyGlowneMarkResultToPostCreateSession(
  session: ZdPostCreateSession,
  input: {
    processedIds: readonly string[];
    /** Status / zęby / zły dostawca — wyjdź z pending, bez undo. */
    dropPendingIds?: readonly string[];
  }
): ZdPostCreateSession {
  const marked = new Set(
    input.processedIds.map((id) => String(id ?? "").trim()).filter(Boolean)
  );
  const drop = new Set(
    [
      ...(input.dropPendingIds ?? []),
      ...input.processedIds,
    ]
      .map((id) => String(id ?? "").trim())
      .filter(Boolean)
  );
  const glowneMarkedIds = [
    ...new Set([...(session.glowneMarkedIds ?? []), ...marked]),
  ];
  const pendingGlowneCatalogIds =
    session.markFreeze.pendingGlowneCatalogIds.filter((id) => !drop.has(id));
  const pendingGlowneServiceIds =
    session.markFreeze.pendingGlowneServiceIds.filter((id) => !drop.has(id));
  const remaining =
    pendingGlowneCatalogIds.length + pendingGlowneServiceIds.length;
  return {
    ...session,
    glowneMarkedIds,
    glowneDone: remaining === 0,
    markFreeze: {
      ...session.markFreeze,
      pendingGlowneCatalogIds,
      pendingGlowneServiceIds,
    },
  };
}

/** @deprecated prefer applyGlowneMarkResultToPostCreateSession */
export function applyGlowneProcessedToPostCreateSession(
  session: ZdPostCreateSession,
  processedIds: readonly string[]
): ZdPostCreateSession {
  return applyGlowneMarkResultToPostCreateSession(session, { processedIds });
}

/** Listy próśb w panelu — tylko to, co jeszcze czeka na Główne + zęby faktycznie na ZD. */
export function pendingGlownePreviewLists(freeze: ZdPostCreateMarkFreeze): {
  catalogRequests: ZdPostCreateRequestSnap[];
  serviceLines: ZdPostCreateServiceSnap[];
} {
  const pendingCat = new Set(freeze.pendingGlowneCatalogIds);
  const pendingSvc = new Set(freeze.pendingGlowneServiceIds);
  const consumed = new Set(freeze.consumedOrderIds);
  return {
    catalogRequests: freeze.catalogRequests.filter((r) =>
      pendingCat.has(r.orderId)
    ),
    serviceLines: freeze.serviceLines
      .map((line) => ({
        ...line,
        requests: line.requests.filter((r) =>
          line.reason === "teeth"
            ? consumed.has(r.orderId)
            : pendingSvc.has(r.orderId)
        ),
      }))
      .filter((line) => line.requests.length > 0),
  };
}

/** Stuby do undo Główne — niezależne od live pendingIndividuals. */
export function undoStubsFromMarkFreeze(
  freeze: ZdPostCreateMarkFreeze,
  orderIds: readonly string[]
): ZdEstimatePendingIndividualOrder[] {
  const want = new Set(
    orderIds.map((id) => String(id ?? "").trim()).filter(Boolean)
  );
  if (!want.size) return [];
  const out: ZdEstimatePendingIndividualOrder[] = [];
  const seen = new Set<string>();
  const push = (r: ZdPostCreateRequestSnap) => {
    if (!want.has(r.orderId) || seen.has(r.orderId)) return;
    seen.add(r.orderId);
    out.push({
      id: r.orderId,
      salesPersonId: "",
      salesPersonName: r.salesPersonName,
      products: r.products,
      symbol: r.symbol,
      mikranCode: null,
      subiektTwId: null,
      qty: r.qty,
      requestNote: r.requestNote,
      salesClientKhId: null,
      sourceZkNumber: null,
    });
  };
  for (const r of freeze.catalogRequests) push(r);
  for (const line of freeze.serviceLines) {
    for (const r of line.requests) push(r);
  }
  return out;
}

/**
 * Po create: zsynchronizuj catalog/services freeze z listami zaakceptowanymi przez serwer.
 */
export function reconcileMarkFreezeWithAcceptedIds(
  freeze: ZdPostCreateMarkFreeze,
  input: {
    acceptedCatalogOrderIds?: readonly string[] | null;
    includedServiceOrderIds?: readonly string[] | null;
  }
): ZdPostCreateMarkFreeze {
  const teethIds = new Set(
    freeze.serviceLines
      .filter((l) => l.reason === "teeth")
      .flatMap((l) => l.requests.map((r) => r.orderId))
  );
  const catalogIds =
    input.acceptedCatalogOrderIds != null
      ? [
          ...new Set(
            input.acceptedCatalogOrderIds
              .map((id) => String(id ?? "").trim())
              .filter(Boolean)
          ),
        ]
      : freeze.pendingGlowneCatalogIds;
  const catalogSet = new Set(catalogIds);
  const includedRaw =
    input.includedServiceOrderIds != null
      ? [
          ...new Set(
            input.includedServiceOrderIds
              .map((id) => String(id ?? "").trim())
              .filter(Boolean)
          ),
        ]
      : [
          ...freeze.pendingGlowneServiceIds,
          ...freeze.consumedOrderIds.filter((id) => teethIds.has(id)),
        ];
  const includedTeeth = includedRaw.filter((id) => teethIds.has(id));
  const includedServices = includedRaw.filter((id) => !teethIds.has(id));
  return {
    ...freeze,
    pendingGlowneCatalogIds: catalogIds,
    pendingGlowneServiceIds: includedServices,
    catalogRequests: freeze.catalogRequests.filter((r) =>
      catalogSet.has(r.orderId)
    ),
    consumedOrderIds: [
      ...new Set([...catalogIds, ...includedServices, ...includedTeeth]),
    ],
    // Gdy serwer podał included — teeth = tylko te na dokumencie (nie max z klienta).
    teethServiceCount:
      input.includedServiceOrderIds != null
        ? includedTeeth.length
        : freeze.teethServiceCount,
  };
}

/** Sumuj jednostki ZD po twId (wiele pozycji Subiekta na ten sam towar). */
export function aggregateCreatedZdLineQtys(
  lines: readonly { twId: number; ilosc: number }[] | null | undefined
): Map<number, number> {
  const map = new Map<number, number>();
  for (const row of lines ?? []) {
    const tw = Math.trunc(Number(row.twId) || 0);
    const qty = Math.max(0, Math.round(Number(row.ilosc) || 0));
    if (!(tw > 0) || !(qty > 0)) continue;
    map.set(tw, (map.get(tw) ?? 0) + qty);
  }
  return map;
}

export function createdLinesFromQtyMap(
  map: ReadonlyMap<number, number>
): Array<{ twId: number; ilosc: number }> {
  return [...map.entries()]
    .filter(([twId, ilosc]) => twId > 0 && ilosc > 0)
    .map(([twId, ilosc]) => ({ twId, ilosc }));
}

export function excludeConsumedPendingOrders(
  orders: readonly ZdEstimatePendingIndividualOrder[],
  consumedIds: ReadonlySet<string> | readonly string[] | null | undefined
): ZdEstimatePendingIndividualOrder[] {
  const skip =
    consumedIds instanceof Set
      ? consumedIds
      : new Set(
          [...(consumedIds ?? [])].map((id) => String(id).trim()).filter(Boolean)
        );
  if (!skip.size) return [...orders];
  return orders.filter((o) => !skip.has(o.id));
}

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
      nazwa: String(l.nazwa ?? "").trim(),
      plu: l.plu?.trim() ? l.plu.trim() : null,
      ilosc: Math.max(0, Math.round(Number(l.ilosc) || 0)),
      packagingHint: l.packagingHint?.trim() ? l.packagingHint.trim() : null,
      individualExtraPieces: Math.max(
        0,
        Math.round(Number(l.individualExtraPieces) || 0)
      ),
      extraOnly: l.extraOnly === true,
      piecesArriving:
        l.piecesArriving != null && Number.isFinite(Number(l.piecesArriving))
          ? Math.max(0, Math.round(Number(l.piecesArriving)))
          : null,
      unitsPerPackage:
        l.unitsPerPackage != null && Number.isFinite(Number(l.unitsPerPackage))
          ? Math.max(0, Math.trunc(Number(l.unitsPerPackage)))
          : null,
      documentUnitMode: l.documentUnitMode ?? null,
      roundupNeed:
        l.roundupNeed != null && Number.isFinite(Number(l.roundupNeed))
          ? Math.max(0, Math.round(Number(l.roundupNeed)))
          : null,
      roundupArrive:
        l.roundupArrive != null && Number.isFinite(Number(l.roundupArrive))
          ? Math.max(0, Math.round(Number(l.roundupArrive)))
          : null,
      bomOrPairLabel: l.bomOrPairLabel?.trim() ? l.bomOrPairLabel.trim() : null,
      celAtLink: Math.max(
        0,
        Number(meta?.celAtLink ?? l.celZapasuTracked) || 0
      ),
      deltaAtLink: Number(meta?.deltaAtLink ?? l.salesTrackDelta) || 0,
    };
  });
}

export function applyCreatedQtyToLineSnapshot(
  lines: readonly ZdPostCreateLineSnap[],
  createdLines: readonly { twId: number; ilosc: number }[] | null | undefined
): ZdPostCreateLineSnap[] {
  if (!createdLines?.length) return lines.map((l) => ({ ...l }));
  const byTw = new Map<number, number>();
  for (const row of createdLines) {
    const tw = Math.trunc(Number(row.twId) || 0);
    const qty = Math.max(0, Math.round(Number(row.ilosc) || 0));
    if (tw > 0) byTw.set(tw, qty);
  }
  return lines.map((line) => {
    const next = byTw.get(line.twId);
    if (next == null || next === line.ilosc) return { ...line };
    const piecesArriving = piecesArrivingForZdUnits(
      next,
      line.unitsPerPackage,
      line.documentUnitMode ?? "packages"
    );
    return { ...line, ilosc: next, piecesArriving };
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
  previewLines: readonly ZdCreatePreviewLine[];
  lineMeta?: readonly ZdPostCreateLineMetaInput[] | null;
  createdLines?: readonly { twId: number; ilosc: number }[] | null;
  markFreeze?: ZdPostCreateMarkFreeze | null;
  bumped?: readonly ZdPostCreateBumpedLine[] | null;
  composedUwagi?: string | null;
  createdAtMs?: number;
}): ZdPostCreateSession {
  const snapped = snapLinesFromCreatePreview(
    input.previewLines,
    input.lineMeta
  );
  const linesSnapshot = applyCreatedQtyToLineSnapshot(
    snapped,
    input.createdLines
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
    linesSnapshot,
    markFreeze: input.markFreeze ?? emptyZdPostCreateMarkFreeze(),
    bumped: [...(input.bumped ?? [])],
    composedUwagi: input.composedUwagi?.trim() || null,
    glowneDone: false,
    glowneMarkedIds: [],
    scheduleDone: false,
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
  markFreeze?: ZdPostCreateMarkFreeze | null;
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
    markFreeze: input.markFreeze ?? emptyZdPostCreateMarkFreeze(),
    bumped: [],
    composedUwagi: null,
    glowneDone: false,
    glowneMarkedIds: [],
    scheduleDone: false,
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
  /** Qty z dokumentu Subiekta (jednostki ZD) — nadpisuje preview po timeout→link. */
  createdLines?: readonly { twId: number; ilosc: number }[] | null;
  markFreeze?: ZdPostCreateMarkFreeze | null;
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
  const baseSnap = fromPrev ?? fromLive ?? [];
  const linesSnapshot = applyCreatedQtyToLineSnapshot(
    baseSnap,
    input.createdLines
  );
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
    linesSnapshot,
    markFreeze:
      prev?.markFreeze ?? input.markFreeze ?? emptyZdPostCreateMarkFreeze(),
    bumped: prev?.bumped ?? [],
    composedUwagi: prev?.composedUwagi ?? null,
    glowneDone: prev?.glowneDone === true,
    glowneMarkedIds: prev?.glowneMarkedIds ?? [],
    scheduleDone: prev?.scheduleDone === true,
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

/** TSV ze snapshota create (nie wymaga pełnych ManualZdEstimateLine). */
export function postCreateLinesSnapshotToTsv(
  lines: readonly ZdPostCreateLineSnap[]
): string {
  const header = [
    "symbol",
    "plu",
    "nazwa",
    "do_zd",
    "sztuki",
    "opakowanie",
    "prosba_szt",
    "tw_Id",
  ].join("\t");
  const rows = lines.map((l) =>
    [
      l.symbol,
      l.plu ?? "",
      l.nazwa,
      l.ilosc,
      l.piecesArriving ?? "",
      l.packagingHint ?? "",
      l.individualExtraPieces || "",
      l.twId,
    ].join("\t")
  );
  return [header, ...rows].join("\n");
}

export function postCreateCreatedUnitsByTwId(
  lines: readonly ZdPostCreateLineSnap[]
): Map<number, number> {
  const map = new Map<number, number>();
  for (const l of lines) {
    if (l.twId > 0 && l.ilosc > 0) map.set(l.twId, l.ilosc);
  }
  return map;
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
