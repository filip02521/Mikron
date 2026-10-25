/**
 * Propozycja ZD automatu → wejście „Utwórz ZD” (to samo, co Kreator wysłałby z tej listy).
 * Prośby dobierane jak w Kreatorze: katalogowe, gdy cały ich towar jest na ZD (także po kodzie
 * Mikran = PLU); usługi = te, które automat uznał za usługi na pełnej liście zakresu (prośba na
 * towar z zakresu, którego nie zamawiamy, usługą nie jest). Serwer sam przycina blok do limitu uwag.
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
  lines: Array<{ twId: number; ilosc: number; symbol: string | null; plu: string | null }>;
  /** Cel i korekta sprzedaży w chwili propozycji — zapis ZD jak z Kreatora. */
  lineMeta: Array<{ twId: number; celAtLink: number | null; deltaAtLink: number | null }>;
  individualCatalogOrderIds: string[];
  individualServiceOrderIds: string[];
  /** Prośby po towarze i usługi — panel po utworzeniu pokazuje je i oznacza jako Główne. */
  extras: Pick<ZdEstimateIndividualBundle, "byTwId" | "serviceLines">;
};

export function buildZdCreateInputFromAutoProposal(input: {
  lines: readonly ZdAutoProposalLine[];
  scope: ZdAutoProposalCreateScope;
  pendingOrders: readonly ZdEstimatePendingIndividualOrder[];
  /** Usługi z propozycji (pełna lista zakresu); null = propozycja bez tej listy → bez usług. */
  serviceOrderIds: readonly string[] | null;
  pairs?: readonly ZdProductPairRef[] | null;
  boms?: readonly ZdProductBomRef[] | null;
  teethTwIds?: ReadonlySet<number> | readonly number[] | null;
}): ZdAutoProposalCreateInput {
  const lines = input.lines
    .filter((l) => Math.trunc(Number(l.twId)) > 0 && Number(l.zdUnits) > 0)
    .map((l) => ({
      twId: Math.trunc(l.twId),
      ilosc: Number(l.zdUnits),
      symbol: l.symbol?.trim() || null,
      plu: l.plu?.trim() || null,
    }));
  const mikranByTw = new Map<number, string>();
  for (const l of lines) if (l.plu) mikranByTw.set(l.twId, l.plu);
  const extras = buildIndividualEstimateExtras({
    orders: input.pendingOrders,
    lines: input.lines.map((l) => ({ tw_Id: l.twId, tw_Symbol: l.symbol, tw_Nazwa: l.nazwa })),
    pairs: input.pairs ?? [],
    boms: input.boms ?? [],
    teethTwIds: input.teethTwIds ?? [],
    mikranByTw,
  });
  const individualCatalogOrderIds = collectIndividualOrderIdsForZdCreate({
    byTwId: extras.byTwId,
    createdTwIds: lines.map((l) => l.twId),
  });
  // Dopasowanie tylko do pozycji ZD widzi jako usługę też prośbę na towar zakresu spoza ZD — usługą
  // jest tylko to, co automat uznał za usługę na pełnej liście (jak Kreator na swojej tabeli).
  const services = new Set(input.serviceOrderIds ?? []);
  const serviceLines = extras.serviceLines
    .map((s) => ({ ...s, requests: s.requests.filter((r) => services.has(r.orderId)) }))
    .filter((s) => s.requests.length > 0);
  const individualServiceOrderIds = [
    ...new Set(serviceLines.flatMap((s) => s.requests.map((r) => r.orderId)).filter(Boolean)),
  ];
  const byLine = new Map(input.lines.map((l) => [Math.trunc(l.twId), l]));
  const lineMeta = lines.map((l) => ({
    twId: l.twId,
    celAtLink: byLine.get(l.twId)?.celAtLink ?? null,
    deltaAtLink: byLine.get(l.twId)?.deltaAtLink ?? null,
  }));
  const mode = input.scope.mode;
  return {
    scopeMode: mode,
    grtId: mode === "grupa" ? input.scope.grupaId : null,
    cechaId: mode === "cecha" ? input.scope.cechaId : null,
    lines,
    lineMeta,
    individualCatalogOrderIds,
    individualServiceOrderIds,
    extras: { byTwId: extras.byTwId, serviceLines },
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

/**
 * Te same blokady co „Utwórz ZD” w Kreatorze (`canCreateZdFromEstimateState`) — propozycja
 * powstaje tylko z listy, z której Kreator pozwoliłby utworzyć ZD. Zwraca przyczynę albo null.
 */
export function zdAutoProposalBlockReason(state: {
  fetchTruncated: boolean;
  strategyActive: boolean;
  salesProfileFailed: boolean;
  explodeBomIncomplete: boolean;
  pendingIndividualsError: string | null;
  pendingIndividualsLoaded: boolean;
  pendingIndividualsTruncated: boolean;
  prosbaOverlapCandidateCount: number;
  prosbaOverlapResolved: boolean;
  historyFetchFailed: boolean;
  packagingPairConflictCount: number;
}): string | null {
  if (state.fetchTruncated) return "Lista z Subiekta niepełna (limit stron) - propozycja nie powstała.";
  // Bez profilu 12 mies. strategia liczy bez podłogi 90 d — propozycja byłaby zaniżona.
  if (state.strategyActive && state.salesProfileFailed) {
    return "Profil sprzedaży z 12 miesięcy niedostępny - propozycja nie powstała.";
  }
  if (state.explodeBomIncomplete) return "Brakuje danych kompletów (BOM) - Kreator pokazałby pustą listę.";
  if (state.pendingIndividualsError?.trim() || !state.pendingIndividualsLoaded) {
    return "Nie wczytano próśb handlowców - propozycja nie powstała (prośby mogłyby nie wejść).";
  }
  if (state.pendingIndividualsTruncated) {
    return "Wczytano tylko pierwsze 500 próśb - odznacz zbędne w panelu Dziś, potem przygotuj propozycję.";
  }
  if (state.prosbaOverlapCandidateCount > 0 && !state.prosbaOverlapResolved) {
    return "Nie sprawdzono rezerwacji ZK pod prośby - prośby mogłyby wejść podwójnie.";
  }
  if (state.historyFetchFailed) return "Nie wczytano historii zamówień ZD - propozycja nie powstała.";
  if (state.packagingPairConflictCount > 0) {
    return `Konflikt opakowanie ↔ para (${state.packagingPairConflictCount}) - ujednolić w Kreatorze ZD.`;
  }
  return null;
}
