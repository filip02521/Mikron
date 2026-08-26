import type { SubiektDocument } from "@/lib/subiekt/types";

export type ZdCreateDocSource = "create" | "reget";

export type ZdCreateDocLineQty = {
  twId: number;
  ilosc: number;
};

export type ResolveDocAfterZdCreateResult = {
  doc: SubiektDocument;
  dokNrPelny: string;
  source: ZdCreateDocSource;
  didReget: boolean;
};

function trimDokNrPelny(raw: string | null | undefined, dokId: number): string {
  const n = String(raw ?? "").trim();
  return n || `ZD/${dokId}`;
}

/** Suma ob_Ilosc > 0 per tw_Id z dokumentu create/GET. */
export function collectPositiveQtyByTwIdFromZdDoc(
  doc: Pick<SubiektDocument, "dok_Pozycja"> | null | undefined
): Map<number, number> {
  const out = new Map<number, number>();
  for (const line of doc?.dok_Pozycja ?? []) {
    const twId = Math.trunc(Number(line.ob_TowId ?? 0));
    if (!(twId > 0)) continue;
    const qty = Number(line.ob_Ilosc);
    if (!(Number.isFinite(qty) && qty > 0)) continue;
    out.set(twId, (out.get(twId) ?? 0) + qty);
  }
  return out;
}

/** @deprecated Używaj {@link zdCreateResponseCoversCreateLines} — tylko obecność tw. */
export function zdCreateResponseCoversCreateTwIds(
  doc: Pick<SubiektDocument, "dok_Pozycja"> | null | undefined,
  createTwIds: ReadonlySet<number>
): boolean {
  if (createTwIds.size === 0) return false;
  const qtyByTw = collectPositiveQtyByTwIdFromZdDoc(doc);
  for (const tw of createTwIds) {
    if (!(qtyByTw.has(tw))) return false;
  }
  return true;
}

/**
 * Czy dokument pokrywa wszystkie wysłane linie: każdy tw obecny
 * i suma ob_Ilosc >= ilosc z create (nadmiar OK).
 */
export function zdCreateResponseCoversCreateLines(
  doc: Pick<SubiektDocument, "dok_Pozycja"> | null | undefined,
  createLines: readonly ZdCreateDocLineQty[]
): boolean {
  if (!createLines.length) return false;
  const qtyByTw = collectPositiveQtyByTwIdFromZdDoc(doc);
  for (const line of createLines) {
    const twId = Math.trunc(Number(line.twId)) || 0;
    const ilosc = Number(line.ilosc);
    if (!(twId > 0) || !(Number.isFinite(ilosc) && ilosc > 0)) return false;
    const have = qtyByTw.get(twId) ?? 0;
    if (!(have >= ilosc)) return false;
  }
  return true;
}

/**
 * Po udanym POST create: użyj dokumentu z create gdy kompletny (tw + qty)
 * lub gdy snapshot wyłączony; inaczej re-GET. Nie buduje linii z request body.
 */
export async function resolveDocAfterZdCreate(input: {
  created: SubiektDocument;
  dokId: number;
  createLines: readonly ZdCreateDocLineQty[];
  persistSnapshots: boolean;
  getById: (dokId: number) => Promise<SubiektDocument>;
}): Promise<ResolveDocAfterZdCreateResult> {
  const dokId = Math.trunc(Number(input.dokId));
  const nrFromCreate = trimDokNrPelny(input.created.dok_NrPelny, dokId);

  if (!input.persistSnapshots) {
    return {
      doc: input.created,
      dokNrPelny: nrFromCreate,
      source: "create",
      didReget: false,
    };
  }

  if (zdCreateResponseCoversCreateLines(input.created, input.createLines)) {
    return {
      doc: input.created,
      dokNrPelny: nrFromCreate,
      source: "create",
      didReget: false,
    };
  }

  const doc = await input.getById(dokId);
  return {
    doc,
    dokNrPelny: trimDokNrPelny(doc.dok_NrPelny, dokId),
    source: "reget",
    didReget: true,
  };
}
