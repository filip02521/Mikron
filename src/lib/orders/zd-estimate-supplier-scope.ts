/**
 * Odwrotne mapowanie: dostawca OnTime → zakres estimate (grupa XOR cecha).
 * Preferuje zapis w DB; heurystyka nazwy + search Subiekta jako fallback.
 */

import type { ZdEstimateRunMode } from "@/lib/orders/zd-estimate-scope";

export type ZdEstimateScopeCandidate = {
  mode: ZdEstimateRunMode;
  id: number;
  label: string;
};

export type ZdEstimateSupplierMatchSource = "mapping" | "name";

/** Wiersz mapowania wystarczający do reverse lookup (grupa/cecha → dostawca). */
export type ZdEstimateScopeMappingRef = {
  supplierId: string;
  mode: ZdEstimateRunMode;
  grupaId: number | null;
  cechaId: number | null;
};

/**
 * Unikalny dostawca z mapowania dla grupy Subiekta.
 * null = brak albo wiele mapowań na ten sam grt_Id.
 */
export function findUniqueSupplierIdForGrupa(
  scopes: readonly ZdEstimateScopeMappingRef[],
  grupaId: number
): string | null {
  const id = Math.trunc(Number(grupaId));
  if (!(id > 0)) return null;
  const hits = scopes.filter(
    (s) => s.mode === "grupa" && s.grupaId != null && Math.trunc(s.grupaId) === id
  );
  if (hits.length !== 1) return null;
  const supplierId = hits[0]!.supplierId.trim();
  return supplierId || null;
}

/**
 * Unikalny dostawca z mapowania dla cechy Subiekta.
 * null = brak albo wiele mapowań na ten sam ctw_Id.
 */
export function findUniqueSupplierIdForCecha(
  scopes: readonly ZdEstimateScopeMappingRef[],
  cechaId: number
): string | null {
  const id = Math.trunc(Number(cechaId));
  if (!(id > 0)) return null;
  const hits = scopes.filter(
    (s) => s.mode === "cecha" && s.cechaId != null && Math.trunc(s.cechaId) === id
  );
  if (hits.length !== 1) return null;
  const supplierId = hits[0]!.supplierId.trim();
  return supplierId || null;
}

export type ZdEstimateSupplierScopeResolved =
  | {
      ok: true;
      mode: ZdEstimateRunMode;
      grupaId: number | null;
      cechaId: number | null;
      label: string;
      source: "db" | "heuristic";
    }
  | { ok: false; reason: "missing" | "ambiguous" | "unavailable" };

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function firstToken(normalized: string): string {
  return normalized.split(/\s+/).find(Boolean) ?? "";
}

/** Preferencje marki — Ivoclar zawsze cecha, nigdy „pierwsza grupa”. */
export function classifySupplierBrand(
  supplierName: string
): "ivoclar" | "falcon" | "other" {
  const n = normalizeName(supplierName);
  if (n.includes("ivoclar")) return "ivoclar";
  if (n.includes("falcon") || firstToken(n) === "falcon") return "falcon";
  return "other";
}

export function pickUniqueScopeByName(
  query: string,
  candidates: readonly ZdEstimateScopeCandidate[]
): ZdEstimateScopeCandidate | null {
  const q = normalizeName(query);
  if (!q || candidates.length === 0) return null;

  const exact = candidates.filter((c) => normalizeName(c.label) === q);
  if (exact.length === 1) return exact[0]!;
  if (exact.length > 1) return null;

  const starts = candidates.filter((c) => {
    const n = normalizeName(c.label);
    return n === q || n.startsWith(`${q} `) || n.startsWith(q);
  });
  if (starts.length === 1) return starts[0]!;
  if (starts.length > 1) {
    const prefer = starts.find((c) => normalizeName(c.label) === q);
    return prefer ?? null;
  }

  const loose = candidates.filter((c) => {
    const n = normalizeName(c.label);
    return n.includes(` ${q} `) || n.includes(q);
  });
  if (loose.length === 1) return loose[0]!;
  return null;
}

/**
 * Pure resolve z gotowych list (testowalny).
 * `db` wygrywa; inaczej heurystyka brand + listy z API.
 */
export function resolveZdEstimateSupplierScopeFromSources(input: {
  supplierName: string;
  db: {
    mode: ZdEstimateRunMode;
    grupaId: number | null;
    cechaId: number | null;
    label: string;
  } | null;
  groups: readonly ZdEstimateScopeCandidate[];
  cechy: readonly ZdEstimateScopeCandidate[];
}): ZdEstimateSupplierScopeResolved {
  if (input.db) {
    const mode = input.db.mode;
    if (mode === "grupa" && input.db.grupaId != null && input.db.grupaId > 0) {
      return {
        ok: true,
        mode: "grupa",
        grupaId: input.db.grupaId,
        cechaId: null,
        label: input.db.label || `Grupa ${input.db.grupaId}`,
        source: "db",
      };
    }
    if (mode === "cecha" && input.db.cechaId != null && input.db.cechaId > 0) {
      return {
        ok: true,
        mode: "cecha",
        grupaId: null,
        cechaId: input.db.cechaId,
        label: input.db.label || `Cecha ${input.db.cechaId}`,
        source: "db",
      };
    }
  }

  const brand = classifySupplierBrand(input.supplierName);
  const token = firstToken(normalizeName(input.supplierName));

  if (brand === "ivoclar") {
    const hit =
      pickUniqueScopeByName("ivoclar", input.cechy) ??
      pickUniqueScopeByName(token, input.cechy);
    if (!hit || hit.mode !== "cecha") {
      return { ok: false, reason: "missing" };
    }
    return {
      ok: true,
      mode: "cecha",
      grupaId: null,
      cechaId: hit.id,
      label: hit.label,
      source: "heuristic",
    };
  }

  if (brand === "falcon") {
    const hit =
      pickUniqueScopeByName("falcon", input.groups) ??
      pickUniqueScopeByName(token, input.groups);
    if (!hit || hit.mode !== "grupa") {
      return { ok: false, reason: "missing" };
    }
    return {
      ok: true,
      mode: "grupa",
      grupaId: hit.id,
      cechaId: null,
      label: hit.label,
      source: "heuristic",
    };
  }

  if (!token || token.length < 3) {
    return { ok: false, reason: "missing" };
  }

  const groupHit = pickUniqueScopeByName(token, input.groups);
  const cechaHit = pickUniqueScopeByName(token, input.cechy);

  if (groupHit && cechaHit) {
    return { ok: false, reason: "ambiguous" };
  }
  if (groupHit) {
    return {
      ok: true,
      mode: "grupa",
      grupaId: groupHit.id,
      cechaId: null,
      label: groupHit.label,
      source: "heuristic",
    };
  }
  if (cechaHit) {
    return {
      ok: true,
      mode: "cecha",
      grupaId: null,
      cechaId: cechaHit.id,
      label: cechaHit.label,
      source: "heuristic",
    };
  }
  return { ok: false, reason: "missing" };
}

/** Query string launch z panelu dziennego. */
export type ZdEstimateLaunchQuery = {
  from?: string | null;
  supplierId?: string | null;
  autorun?: string | null;
  mode?: string | null;
  grupaId?: string | null;
  cechaId?: string | null;
};

export type ZdEstimateLaunchParsed = {
  fromDaily: boolean;
  supplierId: string | null;
  autorun: boolean;
  mode: ZdEstimateRunMode | null;
  grupaId: number | null;
  cechaId: number | null;
};

export function parseZdEstimateLaunchQuery(
  q: ZdEstimateLaunchQuery
): ZdEstimateLaunchParsed {
  const supplierId = String(q.supplierId ?? "").trim() || null;
  const autorunRaw = String(q.autorun ?? "").trim().toLowerCase();
  const autorun =
    autorunRaw === "1" || autorunRaw === "true" || autorunRaw === "yes";
  const fromDaily = String(q.from ?? "").trim().toLowerCase() === "daily";

  const modeRaw = String(q.mode ?? "").trim().toLowerCase();
  const mode: ZdEstimateRunMode | null =
    modeRaw === "grupa" || modeRaw === "cecha" ? modeRaw : null;

  const grupaId = Math.trunc(Number(q.grupaId));
  const cechaId = Math.trunc(Number(q.cechaId));

  return {
    fromDaily,
    supplierId,
    autorun,
    mode,
    grupaId: Number.isFinite(grupaId) && grupaId > 0 ? grupaId : null,
    cechaId: Number.isFinite(cechaId) && cechaId > 0 ? cechaId : null,
  };
}
