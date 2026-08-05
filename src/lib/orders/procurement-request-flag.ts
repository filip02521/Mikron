import type { UserRole } from "@/types/database";
import { canAccessOperations } from "@/lib/auth-roles";
import {
  MAX_PROCUREMENT_FLAG_LABEL_LEN,
  MAX_PROCUREMENT_FLAG_NOTE_LEN,
} from "@/lib/security/text-limits";
import { PROCUREMENT_REQUEST_FLAG_COPY } from "@/lib/orders/procurement-request-flag-copy";

export const PROCUREMENT_FLAG_MIGRATION_HINT =
  "Brak kolumny/tabeli flag zakupów — uruchom supabase/migrations/122_procurement_flag_definitions.sql";

export const PROCUREMENT_FLAG_DEFS_MIGRATION_HINT =
  "Brak tabeli procurement_flag_definitions — uruchom supabase/migrations/122_procurement_flag_definitions.sql";

/** Stałe UUID seed z migracji 122. */
export const PROCUREMENT_FLAG_SEED = {
  pilne: "11111111-1111-4111-8111-111111111101",
  doWyjasnienia: "11111111-1111-4111-8111-111111111102",
  czekaNaKlienta: "11111111-1111-4111-8111-111111111103",
  wstrzymane: "11111111-1111-4111-8111-111111111104",
} as const;

export type ProcurementFlagColor =
  | "rose"
  | "amber"
  | "sky"
  | "fuchsia"
  | "emerald"
  | "slate"
  | "violet";

export const PROCUREMENT_FLAG_COLORS: readonly ProcurementFlagColor[] = [
  "rose",
  "amber",
  "sky",
  "fuchsia",
  "emerald",
  "slate",
  "violet",
] as const;

export type ProcurementFlagDefinition = {
  id: string;
  label: string;
  color: ProcurementFlagColor;
  sortOrder: number;
  isActive: boolean;
};

/** @deprecated alias — id flagi = uuid definicji */
export type ProcurementRequestFlag = string;

export type ForSomeoneLineFlagFields = {
  id: string;
  products: string;
  symbol: string;
  procurementFlag?: string | null;
  procurementFlagNote?: string | null;
};

export type ProcurementFlagGroupSummary =
  | { kind: "none" }
  | {
      kind: "single";
      flag: string;
      note: string | null;
      orderIds: string[];
    }
  | {
      kind: "mixed";
      highestFlag: string;
      flaggedCount: number;
      orderIds: string[];
    };

/** Filtr: all | none | uuid definicji | urlop. */
export type ProcurementListFilter = "all" | "none" | "urlop_dostawcy" | string;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isProcurementFlagUuid(value: string | null | undefined): boolean {
  return Boolean(value && UUID_RE.test(value.trim()));
}

export function parseProcurementFlagId(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return isProcurementFlagUuid(trimmed) ? trimmed.toLowerCase() : null;
}

/** @deprecated użyj parseProcurementFlagId */
export function parseProcurementRequestFlag(
  value: string | null | undefined
): string | null {
  return parseProcurementFlagId(value);
}

export function isProcurementFlagColor(
  value: string | null | undefined
): value is ProcurementFlagColor {
  return Boolean(
    value && (PROCUREMENT_FLAG_COLORS as readonly string[]).includes(value)
  );
}

export function normalizeProcurementFlagLabel(
  value: string | null | undefined
): string | null {
  if (value == null) return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  if (trimmed.length > MAX_PROCUREMENT_FLAG_LABEL_LEN) {
    throw new Error(
      `Nazwa flagi może mieć max ${MAX_PROCUREMENT_FLAG_LABEL_LEN} znaków.`
    );
  }
  return trimmed;
}

export function normalizeProcurementFlagNote(
  value: string | null | undefined
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_PROCUREMENT_FLAG_NOTE_LEN) {
    throw new Error(
      `Opis flagi może mieć max ${MAX_PROCUREMENT_FLAG_NOTE_LEN} znaków.`
    );
  }
  return trimmed;
}

/** Porównanie etykiet (bez wielkości liter, po trim). */
export function procurementFlagLabelsEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function shortProcurementFlagLabel(label: string, max = 18): string {
  /** Tylko kompaktowe miejsca (pasek filtrów) — chip w wierszu prośby pokazuje pełną nazwę. */
  const t = label.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function canEditProcurementRequestFlag(
  role: UserRole | null | undefined
): boolean {
  if (!role) return false;
  return canAccessOperations(role);
}

export function isProcurementFlagColumnMissing(message: string | undefined): boolean {
  return Boolean(
    message?.includes("procurement_flag") ||
      message?.includes("procurement_flag_definitions")
  );
}

export function throwIfProcurementFlagColumnMissing(error: {
  message?: string;
}): void {
  if (isProcurementFlagColumnMissing(error.message)) {
    throw new Error(PROCUREMENT_FLAG_MIGRATION_HINT);
  }
}

export function mapFlagDefinitionRow(row: {
  id: string;
  label: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}): ProcurementFlagDefinition | null {
  if (!isProcurementFlagColor(row.color)) return null;
  return {
    id: row.id,
    label: row.label,
    color: row.color,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

export function buildFlagDefinitionMap(
  defs: ProcurementFlagDefinition[]
): Map<string, ProcurementFlagDefinition> {
  return new Map(defs.map((d) => [d.id.toLowerCase(), d]));
}

export function findFlagDefinition(
  defs: ProcurementFlagDefinition[] | Map<string, ProcurementFlagDefinition>,
  flagId: string | null | undefined
): ProcurementFlagDefinition | null {
  if (!flagId) return null;
  const key = flagId.toLowerCase();
  if (defs instanceof Map) return defs.get(key) ?? null;
  return defs.find((d) => d.id.toLowerCase() === key) ?? null;
}

export const PROCUREMENT_FLAG_ORPHAN_PRIORITY = 900;
export const PROCUREMENT_FLAG_NONE_PRIORITY = 1000;

export function procurementFlagPriority(
  flagId: string | null | undefined,
  sortById: Map<string, number> | Record<string, number>
): number {
  if (!flagId) return PROCUREMENT_FLAG_NONE_PRIORITY;
  const key = flagId.toLowerCase();
  const order =
    sortById instanceof Map ? sortById.get(key) : sortById[key];
  if (typeof order === "number") return order;
  return PROCUREMENT_FLAG_ORPHAN_PRIORITY;
}

export function buildFlagSortOrderMap(
  defs: ProcurementFlagDefinition[]
): Map<string, number> {
  return new Map(defs.map((d) => [d.id.toLowerCase(), d.sortOrder]));
}

export function groupHighestFlagPriority(
  lines: ForSomeoneLineFlagFields[],
  sortById: Map<string, number> | Record<string, number>
): number {
  if (!lines.length) return PROCUREMENT_FLAG_NONE_PRIORITY;
  let best = PROCUREMENT_FLAG_NONE_PRIORITY;
  for (const line of lines) {
    const p = procurementFlagPriority(line.procurementFlag, sortById);
    if (p < best) best = p;
  }
  return best;
}

export function summarizeGroupProcurementFlags(
  lines: ForSomeoneLineFlagFields[],
  sortById?: Map<string, number> | Record<string, number>
): ProcurementFlagGroupSummary {
  const flagged = lines.filter((l) => l.procurementFlag);
  if (!flagged.length) return { kind: "none" };

  const first = flagged[0]!.procurementFlag!;
  const unanimous = flagged.every((l) => l.procurementFlag === first);
  if (unanimous && flagged.length === lines.length) {
    const notes = new Set(
      flagged.map((l) => l.procurementFlagNote?.trim() || "").filter(Boolean)
    );
    return {
      kind: "single",
      flag: first,
      note:
        notes.size === 1
          ? [...notes][0]!
          : notes.size > 1
            ? null
            : flagged[0]!.procurementFlagNote ?? null,
      orderIds: flagged.map((l) => l.id),
    };
  }

  const orderMap = sortById ?? {};
  let highest = flagged[0]!;
  for (const line of flagged) {
    if (
      procurementFlagPriority(line.procurementFlag, orderMap) <
      procurementFlagPriority(highest.procurementFlag, orderMap)
    ) {
      highest = line;
    }
  }
  return {
    kind: "mixed",
    highestFlag: highest.procurementFlag!,
    flaggedCount: flagged.length,
    orderIds: flagged.map((l) => l.id),
  };
}

export function groupHasProcurementFlag(lines: ForSomeoneLineFlagFields[]): boolean {
  return lines.some((l) => Boolean(l.procurementFlag));
}

export function groupMatchesProcurementFlagFilter(
  lines: ForSomeoneLineFlagFields[],
  filter: Exclude<ProcurementListFilter, "urlop_dostawcy">,
  opts?: { supplierOnVacation?: boolean }
): boolean {
  if (filter === "all") return true;
  if (filter === "none") {
    if (opts?.supplierOnVacation) return false;
    return lines.every((l) => !l.procurementFlag);
  }
  return lines.some((l) => l.procurementFlag?.toLowerCase() === filter.toLowerCase());
}

export type ProcurementFilterCountGroup = {
  supplierId: string;
  lines: ForSomeoneLineFlagFields[];
};

/**
 * Liczba grup (próśb) pasujących do każdego chipa filtra.
 * Klucze: "all" | "none" | "urlop_dostawcy" | uuid aktywnej flagi.
 */
export function buildProcurementListFilterCounts(
  groups: ProcurementFilterCountGroup[],
  opts: {
    activeFlagIds: string[];
    suppliersOnVacationNow: Record<string, unknown>;
  }
): Record<string, number> {
  const counts: Record<string, number> = {
    all: groups.length,
    none: 0,
    urlop_dostawcy: 0,
  };
  for (const id of opts.activeFlagIds) {
    counts[id] = 0;
  }

  for (const g of groups) {
    const onVacation = Boolean(opts.suppliersOnVacationNow[g.supplierId]);
    if (onVacation) counts.urlop_dostawcy = (counts.urlop_dostawcy ?? 0) + 1;

    if (
      groupMatchesProcurementFlagFilter(g.lines, "none", {
        supplierOnVacation: onVacation,
      })
    ) {
      counts.none = (counts.none ?? 0) + 1;
    }

    for (const id of opts.activeFlagIds) {
      if (groupMatchesProcurementFlagFilter(g.lines, id)) {
        counts[id] = (counts[id] ?? 0) + 1;
      }
    }
  }

  return counts;
}

export function procurementFlagChipClass(color: ProcurementFlagColor): string {
  switch (color) {
    case "rose":
      return "bg-rose-50/95 text-rose-800 ring-rose-200/90";
    case "amber":
      return "bg-amber-50/95 text-amber-900 ring-amber-200/90";
    case "sky":
      return "bg-sky-50/95 text-sky-800 ring-sky-200/90";
    case "fuchsia":
      return "bg-fuchsia-50/95 text-fuchsia-900 ring-fuchsia-200/80";
    case "emerald":
      return "bg-emerald-50/95 text-emerald-900 ring-emerald-200/80";
    case "violet":
      return "bg-violet-50/95 text-violet-900 ring-violet-200/80";
    case "slate":
    default:
      return "bg-slate-100/95 text-slate-700 ring-slate-200/90";
  }
}

export function procurementFlagDotClass(color: ProcurementFlagColor): string {
  switch (color) {
    case "rose":
      return "bg-rose-500";
    case "amber":
      return "bg-amber-500";
    case "sky":
      return "bg-sky-500";
    case "fuchsia":
      return "bg-fuchsia-500";
    case "emerald":
      return "bg-emerald-500";
    case "violet":
      return "bg-violet-500";
    case "slate":
    default:
      return "bg-slate-400";
  }
}

/**
 * Kiedy opis w chipie flagi startuje jako jednoliniowy podgląd
 * (rozwinięcie = pełny tekst w tym samym obiekcie).
 */
export function procurementFlagNoteNeedsExpand(note: string): boolean {
  const t = note.trim();
  if (!t) return false;
  if (/\r?\n/.test(t)) return true;
  if (t.length > 48) return true;
  return false;
}

export function procurementFlagModalChipSelectedClass(
  color: ProcurementFlagColor
): string {
  switch (color) {
    case "rose":
      return "border-rose-400/90 bg-gradient-to-b from-rose-50 to-white text-rose-950 ring-1 ring-rose-200/60";
    case "amber":
      return "border-amber-400/90 bg-gradient-to-b from-amber-50 to-white text-amber-950 ring-1 ring-amber-200/60";
    case "sky":
      return "border-sky-400/90 bg-gradient-to-b from-sky-50 to-white text-sky-950 ring-1 ring-sky-200/60";
    case "fuchsia":
      return "border-fuchsia-400/90 bg-gradient-to-b from-fuchsia-50 to-white text-fuchsia-950 ring-1 ring-fuchsia-200/60";
    case "emerald":
      return "border-emerald-400/90 bg-gradient-to-b from-emerald-50 to-white text-emerald-950 ring-1 ring-emerald-200/60";
    case "violet":
      return "border-violet-400/90 bg-gradient-to-b from-violet-50 to-white text-violet-950 ring-1 ring-violet-200/60";
    case "slate":
    default:
      return "border-slate-400/90 bg-gradient-to-b from-slate-50 to-white text-slate-900 ring-1 ring-slate-200/60";
  }
}

export function procurementFlagMixedChipLabel(count: number): string {
  return `${PROCUREMENT_REQUEST_FLAG_COPY.mixedChip} (${count})`;
}

/** Alias tonu = kolor (kompatybilność chipów). */
export type ProcurementRequestFlagTone = ProcurementFlagColor;
