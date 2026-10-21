/**
 * Propozycja ZD automatu → wejście „Utwórz ZD” (to samo, co Kreator wysłałby z tej listy).
 * Prośby dobierane jak w Kreatorze: katalogowe, gdy cały ich towar jest na ZD; usługi do uwag
 * (serwer sam przycina blok do limitu uwag).
 */
import type { ZdAutoProposalLine } from "@/lib/data/zd-auto-proposals";
import type { ZdProductBomRef } from "@/lib/orders/zd-estimate-bom";
import {
  buildIndividualEstimateExtras,
  collectIndividualOrderIdsForZdCreate,
  type ZdEstimateIndividualBundle,
  type ZdEstimatePendingIndividualOrder,
} from "@/lib/orders/zd-estimate-individual";
import type { ZdProductPairRef } from "@/lib/orders/zd-product-pair-units";

export type ZdAutoProposalCreateScope = {
  mode: "grupa" | "cecha";
  grupaId: number | null;
  cechaId: number | null;
};

export type ZdAutoProposalCreateInput = {
  scopeMode: "grupa" | "cecha";
  grtId: number | null;
  cechaId: number | null;
  lines: Array<{ twId: number; ilosc: number; symbol: string | null }>;
  individualCatalogOrderIds: string[];
  individualServiceOrderIds: string[];
  /** Prośby po towarze i usługi — panel po utworzeniu pokazuje je i oznacza jako Główne. */
  extras: Pick<ZdEstimateIndividualBundle, "byTwId" | "serviceLines">;
};

export function buildZdCreateInputFromAutoProposal(input: {
  lines: readonly ZdAutoProposalLine[];
  scope: ZdAutoProposalCreateScope;
  pendingOrders: readonly ZdEstimatePendingIndividualOrder[];
  pairs?: readonly ZdProductPairRef[] | null;
  boms?: readonly ZdProductBomRef[] | null;
  teethTwIds?: ReadonlySet<number> | readonly number[] | null;
}): ZdAutoProposalCreateInput {
  const lines = input.lines
    .filter((l) => Math.trunc(Number(l.twId)) > 0 && Number(l.zdUnits) > 0)
    .map((l) => ({ twId: Math.trunc(l.twId), ilosc: Number(l.zdUnits), symbol: l.symbol?.trim() || null }));
  const extras = buildIndividualEstimateExtras({
    orders: input.pendingOrders,
    lines: input.lines.map((l) => ({ tw_Id: l.twId, tw_Symbol: l.symbol, tw_Nazwa: l.nazwa })),
    pairs: input.pairs ?? [],
    boms: input.boms ?? [],
    teethTwIds: input.teethTwIds ?? [],
  });
  const individualCatalogOrderIds = collectIndividualOrderIdsForZdCreate({
    byTwId: extras.byTwId,
    createdTwIds: lines.map((l) => l.twId),
  });
  const individualServiceOrderIds = [
    ...new Set(extras.serviceLines.flatMap((s) => s.requests.map((r) => r.orderId)).filter(Boolean)),
  ];
  const mode = input.scope.mode;
  return {
    scopeMode: mode,
    grtId: mode === "grupa" ? input.scope.grupaId : null,
    cechaId: mode === "cecha" ? input.scope.cechaId : null,
    lines,
    individualCatalogOrderIds,
    individualServiceOrderIds,
    extras: { byTwId: extras.byTwId, serviceLines: extras.serviceLines },
  };
}

export type ZdAutoProposalLineChange = "added" | "removed" | "changed" | "same";

/** Rano → po przeliczeniu: zmiana każdej pozycji (jednostki ZD), w kolejności nowej listy, usunięte na końcu. */
export function diffZdAutoProposalLines(
  before: readonly ZdAutoProposalLine[],
  after: readonly ZdAutoProposalLine[]
): Array<{ line: ZdAutoProposalLine; change: ZdAutoProposalLineChange; beforeUnits: number | null }> {
  const prev = new Map(before.map((l) => [l.twId, l]));
  const out: Array<{ line: ZdAutoProposalLine; change: ZdAutoProposalLineChange; beforeUnits: number | null }> = after.map((l) => {
    const b = prev.get(l.twId);
    prev.delete(l.twId);
    if (!b) return { line: l, change: "added" as const, beforeUnits: null };
    return { line: l, change: b.zdUnits === l.zdUnits ? ("same" as const) : ("changed" as const), beforeUnits: b.zdUnits };
  });
  for (const b of prev.values()) out.push({ line: b, change: "removed", beforeUnits: b.zdUnits });
  return out;
}

/** Najwyżej tyle jednostek ZD na pozycję w korekcie — literówka (dopisane zero) nie trafi do Subiekta. */
export const ZD_AUTO_PROPOSAL_EDIT_MAX_UNITS = 9999;

/**
 * Korekty z panelu (twId → jednostki ZD, 0 = usuń). Tylko towary z propozycji — nic spoza listy
 * nie wchodzi tą drogą; sztuki przeliczane w tej samej proporcji co w propozycji.
 */
export function applyZdAutoProposalEdits(
  lines: readonly ZdAutoProposalLine[],
  edits: Readonly<Record<string, number>> | null | undefined
): { ok: true; lines: ZdAutoProposalLine[] } | { ok: false; message: string } {
  if (!edits) return { ok: true, lines: [...lines] };
  const known = new Set(lines.map((l) => String(l.twId)));
  for (const [key, value] of Object.entries(edits)) {
    if (!known.has(key)) return { ok: false, message: "Korekta dotyczy towaru spoza propozycji - przelicz ją ponownie." };
    if (!Number.isInteger(value) || value < 0 || value > ZD_AUTO_PROPOSAL_EDIT_MAX_UNITS) {
      return { ok: false, message: `Nieprawidłowa ilość w korekcie (0–${ZD_AUTO_PROPOSAL_EDIT_MAX_UNITS}).` };
    }
  }
  const out = lines.flatMap((l) => {
    const v = edits[String(l.twId)];
    if (v == null) return [l];
    if (v === 0) return [];
    const perUnit = l.zdUnits > 0 ? l.pieces / l.zdUnits : 1;
    return [{ ...l, zdUnits: v, pieces: Math.round(v * perUnit * 1000) / 1000 }];
  });
  return { ok: true, lines: out };
}
