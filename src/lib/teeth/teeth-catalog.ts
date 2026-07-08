import {
  TEETH_LINE_DEFINITIONS,
  TEETH_LINE_BY_ID,
  teethLineDefinition,
  teethLinesForManufacturer,
  teethColorsForLine,
  toothMouldsForLine,
  hasMouldsForLineKind,
  lineHasAnyMoulds,
  lineOptionalMould,
  type TeethLineDefinition,
} from "./teeth-lines-data";
import { jawRequiredForKind } from "./teeth-mould-shape-groups";
import { TEETH_CHIP_OTHER } from "./teeth-palettes";
import type {
  TeethManufacturer,
  TeethProductLine,
  TeethJaw,
  TeethKind,
} from "./teeth-catalog-types";
import { isCrossLineDualKindPair } from "./teeth-cross-line-pairs";

export type { TeethManufacturer, TeethProductLine, TeethJaw, TeethKind };
export { parseTeethJaw, parseTeethKind } from "./teeth-catalog-types";
export { TEETH_CHIP_OTHER };

export const TEETH_KIND_LABELS: Record<TeethKind, string> = {
  anterior: "Przednie",
  posterior: "Boczne",
};

export const TEETH_MANUFACTURERS: { id: TeethManufacturer; label: string }[] = [
  { id: "ivoclar", label: "Ivoclar" },
  { id: "wiedent", label: "Wiedent" },
  { id: "dentex", label: "Dentex" },
  { id: "major", label: "Major Dental" },
  { id: "schottlander", label: "Schottlander" },
  { id: "hansen", label: "Hansen Dental" },
  { id: "mgm", label: "MGM System" },
  { id: "formed", label: "Formed" },
];

export const TEETH_PRODUCT_LINES: TeethLineDefinition[] = [...TEETH_LINE_DEFINITIONS];

const MANUFACTURER_IDS = new Set<string>(TEETH_MANUFACTURERS.map((m) => m.id));
const PRODUCT_LINE_IDS = new Set<string>(TEETH_LINE_DEFINITIONS.map((d) => d.id));

const DEFAULT_LINE_BY_MANUFACTURER: Record<TeethManufacturer, TeethProductLine> = {
  wiedent: "wiedent_estetic",
  ivoclar: "ivoclar_ivostar",
  dentex: "dentex_amberlux",
  major: "major_super_lux",
  schottlander: "schottlander_enigmalife",
  hansen: "hansen_generic",
  mgm: "mgm_generic",
  formed: "formed_generic",
};

export function teethManufacturerLabel(id: TeethManufacturer | null | undefined): string | null {
  if (!id) return null;
  return TEETH_MANUFACTURERS.find((m) => m.id === id)?.label ?? null;
}

export function teethProductLineLabel(id: TeethProductLine | null | undefined): string | null {
  if (!id) return null;
  return TEETH_LINE_BY_ID.get(id)?.label ?? null;
}

export function isTeethManufacturer(value: string): value is TeethManufacturer {
  return MANUFACTURER_IDS.has(value);
}

export function isTeethProductLine(value: string): value is TeethProductLine {
  return PRODUCT_LINE_IDS.has(value);
}

export function parseTeethManufacturer(value: unknown): TeethManufacturer | null {
  if (typeof value !== "string") return null;
  return isTeethManufacturer(value) ? value : null;
}

export function parseTeethProductLine(value: unknown): TeethProductLine | null {
  if (typeof value !== "string") return null;
  return isTeethProductLine(value) ? value : null;
}

export function manufacturerForProductLine(line: TeethProductLine): TeethManufacturer {
  return teethLineDefinition(line).manufacturer;
}

export function defaultProductLineForManufacturer(manufacturer: TeethManufacturer): TeethProductLine {
  return DEFAULT_LINE_BY_MANUFACTURER[manufacturer];
}

const ANTERIOR_KEYWORDS = ["przednie", "przód", "przod", "przedni", "front", "przody"];
const POSTERIOR_KEYWORDS = ["boczne", "boczny", "tylne", "tylny", "tył", "tyl", "back", "boki"];

/** Nazwa towaru wskazuje linię Wiedent Estetic wg skali VITA (nie skala W). */
export function isWiedentEsteticVitaProductName(productName: string): boolean {
  const n = productName.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (!n.includes("wiedent") && !n.includes("wident")) return false;
  if (/wg\.?\s*vity|wg\s+vity/.test(n)) return true;
  if (n.includes("estetic") && n.includes("vita")) return true;
  // np. „Wiedent Vita zęby przody” — bez słowa „estetic”
  if (/\bvita\b/.test(n)) return true;
  return n.includes("vita");
}

export function detectTeethKind(name: string): TeethKind | null {
  const lower = name.toLowerCase();
  if (ANTERIOR_KEYWORDS.some((kw) => lower.includes(kw))) return "anterior";
  if (POSTERIOR_KEYWORDS.some((kw) => lower.includes(kw))) return "posterior";
  return null;
}

/** Wykrywa linię produktową z nazwy towaru (Subiekt / Mikran). */
export function detectTeethProductLine(
  productName: string,
  hints?: { manufacturer?: TeethManufacturer | null },
): TeethProductLine | null {
  const n = productName.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

  if (n.includes("classic") && (n.includes("wiedent") || n.includes("wident"))) {
    return "wiedent_classic";
  }
  if (/alma\s*miss|almamiss/.test(n)) {
    return "wiedent_almamiss";
  }
  if (/om\s*1|om\s*3|0m1|0m3|wybielon/.test(n) && n.includes("wiedent")) {
    return "wiedent_estetic_om";
  }
  if (isWiedentEsteticVitaProductName(productName)) {
    return "wiedent_estetic_vita";
  }
  if (n.includes("wiedent") || n.includes("wident")) {
    return "wiedent_estetic";
  }

  if (n.includes("phonares")) return "ivoclar_phonares_ii";
  if (n.includes("vivodent")) return "ivoclar_vivodent_dcl";
  if (n.includes("orthotyp")) return "ivoclar_orthotyp_dcl";
  if (n.includes("gnathostar")) return "ivoclar_gnathostar";
  if (n.includes("ivostar")) return "ivoclar_ivostar";

  if (n.includes("super") && n.includes("lux")) return "major_super_lux";
  if (n.includes("kompozyt") && n.includes("major")) return "major_composite";
  if (n.includes("major") && n.includes("dent")) return "major_dent";
  if (n.includes("major")) return "major_super_lux";

  if (n.includes("dentex") || n.includes("amberlux") || n.includes("amber lux")) {
    if (
      /\bdentex[\s-]*v\b/.test(n) ||
      /skala\s*v/.test(n) ||
      /\b(a|b|c|d)\d+(\.5)?v\b/.test(n)
    ) {
      return "dentex_amberlux_v";
    }
    return "dentex_amberlux";
  }

  if (n.includes("enigma")) return "schottlander_enigmalife";
  if (n.includes("schottlander")) return "schottlander_enigmalife";

  if (n.includes("hansen")) return "hansen_generic";
  if (n.includes("mgm")) return "mgm_generic";
  if (n.includes("formed")) return "formed_generic";

  if (hints?.manufacturer) {
    return defaultProductLineForManufacturer(hints.manufacturer);
  }

  return null;
}

export type TeethCatalogRef = {
  productLine: TeethProductLine;
};

export function resolveTeethCatalog(input: {
  /** Mapowanie admina (prosba_teeth_products) — najwyższy priorytet. */
  adminProductLine?: TeethProductLine | null;
  manufacturer?: TeethManufacturer | null;
  productName?: string | null;
  /** Linia zamrożona przy wyborze towaru — tylko gdy nazwa nie pozwala wykryć linii. */
  frozenProductLine?: TeethProductLine | null;
}): TeethCatalogRef | null {
  const line = authoritativeTeethProductLine({
    adminProductLine: input.adminProductLine,
    teethManufacturer: input.manufacturer,
    product: input.productName,
    frozenProductLine: input.frozenProductLine,
  });
  return line ? { productLine: line } : null;
}

/**
 * Wyznacza linię produktową wyłącznie z towaru (admin + nazwa).
 * Ręczna zmiana linii w UI nie jest dozwolona — inny katalog = inny towar.
 */
export function authoritativeTeethProductLine(input: {
  adminProductLine?: TeethProductLine | null;
  teethManufacturer?: TeethManufacturer | null;
  product?: string | null;
  frozenProductLine?: TeethProductLine | null;
}): TeethProductLine | null {
  const fromName = input.product?.trim()
    ? detectTeethProductLine(input.product, { manufacturer: input.teethManufacturer })
    : null;

  if (input.adminProductLine) {
    // Legacy admin: ogólny estetic zamiast linii Vita wykrytej z nazwy towaru.
    if (
      input.adminProductLine === "wiedent_estetic" &&
      fromName === "wiedent_estetic_vita"
    ) {
      return fromName;
    }
    return input.adminProductLine;
  }
  if (fromName) return fromName;
  if (input.frozenProductLine) return input.frozenProductLine;
  if (input.teethManufacturer) {
    return defaultProductLineForManufacturer(input.teethManufacturer);
  }
  return null;
}

export function teethColorsFor(catalog: TeethCatalogRef): readonly string[] {
  return teethColorsForLine(catalog.productLine);
}

export function toothMouldsFor(catalog: TeethCatalogRef, kind: TeethKind): readonly string[] {
  return toothMouldsForLine(catalog.productLine, kind);
}

export function hasMouldsForKind(catalog: TeethCatalogRef, kind: TeethKind): boolean {
  return hasMouldsForLineKind(catalog.productLine, kind);
}

export function hasMoulds(catalog: TeethCatalogRef): boolean {
  return lineHasAnyMoulds(catalog.productLine);
}

export function mouldRequiredForKind(catalog: TeethCatalogRef, kind: TeethKind): boolean {
  if (lineOptionalMould(catalog.productLine)) return false;
  return hasMouldsForLineKind(catalog.productLine, kind);
}

export type TeethLineDetail = {
  position: number;
  color: string;
  mould?: string | null;
  jaw?: TeethJaw | null;
  kind?: TeethKind | null;
  /** @deprecated use mould instead */
  size?: string | null;
};

export function isTeethDetailComplete(
  detail: TeethLineDetail,
  catalog: TeethCatalogRef,
): boolean {
  if (!detail.color.trim() || detail.color === TEETH_CHIP_OTHER) return false;
  if (!detail.kind) return false;
  if (jawRequiredForKind(detail.kind) && !detail.jaw) return false;
  if (mouldRequiredForKind(catalog, detail.kind) && !detail.mould?.trim()) return false;
  if (detail.mould === TEETH_CHIP_OTHER) return false;
  return true;
}

export function allTeethDetailsComplete(
  details: TeethLineDetail[] | undefined,
  catalog: TeethCatalogRef | null | undefined,
  expectedCount: number,
): boolean {
  if (!catalog) return true;
  if (!details || details.length < expectedCount) return false;
  return details.slice(0, expectedCount).every((d) => isTeethDetailComplete(d, catalog));
}

export function expandTeethDetails(
  details: TeethLineDetail[] | undefined,
  count: number,
): TeethLineDetail[] {
  if (!details || details.length === 0) {
    return Array.from({ length: count }, (_, i) => ({
      position: i + 1,
      color: "",
      mould: null,
      jaw: null,
      kind: null,
    }));
  }
  if (details.length === count) return details;
  if (details.length > count) return details.slice(0, count);
  return [
    ...details,
    ...Array.from({ length: count - details.length }, (_, i) => ({
      position: details.length + i + 1,
      color: "",
      mould: null,
      jaw: null,
      kind: null,
    })),
  ];
}

export type TeethGroupedDetail = {
  color: string;
  mould: string | null;
  jaw: TeethJaw | null;
  kind: TeethKind | null;
  count: number;
};

export function groupTeethDetails(
  details: TeethLineDetail[] | undefined,
): TeethGroupedDetail[] {
  if (!details || details.length === 0) return [];
  const map = new Map<string, TeethGroupedDetail>();
  for (const d of details) {
    const jaw = (d.jaw ?? null) as TeethJaw | null;
    const kind = (d.kind ?? null) as TeethKind | null;
    const key = `${d.color}|${d.mould ?? ""}|${jaw ?? ""}|${kind ?? ""}`;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
    } else {
      map.set(key, { color: d.color, mould: d.mould ?? null, jaw, kind, count: 1 });
    }
  }
  return Array.from(map.values());
}

export type TeethGroupDraft = TeethGroupedDetail & {
  id: string;
};

export function createTeethGroupDraft(
  partial?: Partial<Omit<TeethGroupDraft, "id">> & { id?: string },
): TeethGroupDraft {
  return {
    id: partial?.id ?? `tg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    color: partial?.color ?? "",
    mould: partial?.mould ?? null,
    jaw: partial?.jaw ?? null,
    kind: partial?.kind ?? null,
    count: Math.max(1, partial?.count ?? 1),
  };
}

export function teethGroupsFromDetails(
  details: TeethLineDetail[] | undefined,
): TeethGroupDraft[] {
  return groupTeethDetails(details).map((g, i) =>
    createTeethGroupDraft({ ...g, id: `tg-import-${i}` }),
  );
}

export function expandTeethGroups(groups: TeethGroupDraft[]): TeethLineDetail[] {
  const result: TeethLineDetail[] = [];
  let position = 1;
  for (const g of groups) {
    const count = Math.max(1, g.count);
    for (let i = 0; i < count; i++) {
      result.push({
        position: position++,
        color: g.color,
        mould: g.mould,
        jaw: g.jaw,
        kind: g.kind,
      });
    }
  }
  return result;
}

export function totalTeethCountFromGroups(groups: TeethGroupDraft[]): number {
  return groups.reduce((sum, g) => sum + Math.max(1, g.count), 0);
}

export function isTeethGroupComplete(
  group: Pick<TeethGroupDraft, "color" | "mould" | "jaw" | "kind" | "count">,
  catalog: TeethCatalogRef,
): boolean {
  if (group.count < 1) return false;
  return isTeethDetailComplete(
    {
      position: 1,
      color: group.color,
      mould: group.mould,
      jaw: group.jaw,
      kind: group.kind,
    },
    catalog,
  );
}

export function allTeethGroupsComplete(
  groups: TeethGroupDraft[],
  catalog: TeethCatalogRef,
): boolean {
  if (groups.length === 0) return false;
  return groups.every((g) => isTeethGroupComplete(g, catalog));
}

const JAW_SHORT: Record<TeethJaw, string> = { upper: "góra", lower: "dół" };

export function formatTeethGroupLabel(
  group: Pick<TeethGroupDraft, "color" | "mould" | "jaw" | "kind" | "count">,
  options?: { includeCount?: boolean },
): string {
  const includeCount = options?.includeCount !== false;
  const parts: string[] = [];
  if (group.color.trim()) parts.push(group.color.trim());
  if (group.mould?.trim()) parts.push(group.mould.trim());
  if (group.kind && jawRequiredForKind(group.kind) && group.jaw) {
    parts.push(JAW_SHORT[group.jaw]);
  }
  if (group.kind) parts.push(TEETH_KIND_LABELS[group.kind].toLowerCase());
  const spec = parts.length > 0 ? parts.join(" · ") : "—";
  if (!includeCount) return spec;
  const n = Math.max(1, group.count);
  return `${spec} × ${n} szt.`;
}

/** Rozwiązuje katalog z pól pozycji zamówienia / prośby. */
export function resolveTeethCatalogFromDraft(input: {
  teethProductLine?: TeethProductLine | null;
  teethManufacturer?: TeethManufacturer | null;
  product?: string | null;
  /** Mapowanie admina dla subiektTwId — ma pierwszeństwo nad frozenProductLine. */
  adminProductLine?: TeethProductLine | null;
  subiektTwId?: number | null;
}): TeethCatalogRef | null {
  return resolveTeethCatalog({
    adminProductLine: input.adminProductLine,
    manufacturer: input.teethManufacturer,
    productName: input.product,
    frozenProductLine: input.teethProductLine,
  });
}

export { teethLinesForManufacturer, teethLineDefinition, lineOptionalMould };

/** Czy sync katalogu z admina unieważnia listę (nie przy pierwszym uzupełnieniu linii z null). */
export function shouldClearTeethDetailsOnCatalogSync(
  currentProductLine: TeethProductLine | null | undefined,
  resolvedProductLine: TeethProductLine,
): boolean {
  if (currentProductLine == null || currentProductLine === resolvedProductLine) {
    return false;
  }
  if (isCrossLineDualKindPair(currentProductLine, resolvedProductLine)) {
    return false;
  }
  return true;
}
