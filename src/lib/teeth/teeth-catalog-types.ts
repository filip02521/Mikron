export type TeethManufacturer =
  | "ivoclar"
  | "wiedent"
  | "dentex"
  | "major"
  | "schottlander"
  | "hansen"
  | "mgm"
  | "formed";

export type TeethProductLine =
  | "wiedent_classic"
  | "wiedent_estetic"
  | "wiedent_estetic_vita"
  | "wiedent_estetic_om"
  | "ivoclar_ivostar"
  | "ivoclar_gnathostar"
  | "ivoclar_phonares_ii"
  | "ivoclar_vivodent_dcl"
  | "ivoclar_orthotyp_dcl"
  | "major_super_lux"
  | "major_composite"
  | "major_dent"
  | "dentex_amberlux"
  | "schottlander_enigmalife"
  | "hansen_generic"
  | "mgm_generic"
  | "formed_generic";

export type TeethJaw = "upper" | "lower";

export type TeethKind = "anterior" | "posterior";

function normalizeTeethToken(raw: unknown): string {
  if (raw == null) return "";
  return String(raw)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Normalizuje wartość szczęki z bazy (upper/lower lub polskie skróty). */
export function parseTeethJaw(raw: unknown, fallbackRaw?: unknown): TeethJaw | null {
  for (const value of [raw, fallbackRaw]) {
    const token = normalizeTeethToken(value);
    if (!token) continue;
    if (token === "upper" || token.startsWith("gor")) return "upper";
    if (token === "lower" || token.startsWith("dol")) return "lower";
  }
  return null;
}

/** Normalizuje typ zęba z bazy. */
export function parseTeethKind(raw: unknown): TeethKind | null {
  const token = normalizeTeethToken(raw);
  if (!token) return null;
  if (token === "anterior" || token.startsWith("przed")) return "anterior";
  if (
    token === "posterior" ||
    token.startsWith("tyln") ||
    token.startsWith("bocz") ||
    token === "boki" ||
    token.startsWith("bok")
  ) {
    return "posterior";
  }
  return null;
}
