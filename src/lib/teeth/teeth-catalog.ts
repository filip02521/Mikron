export type TeethManufacturer = "ivoclar" | "wiedent" | "dentex" | "major" | "hansen" | "mgm" | "formed";

export type TeethJaw = "upper" | "lower";

export type TeethKind = "anterior" | "posterior";

export const TEETH_KIND_LABELS: Record<TeethKind, string> = {
  anterior: "Przednie",
  posterior: "Tylne",
};

export const TEETH_MANUFACTURERS: {
  id: TeethManufacturer;
  label: string;
}[] = [
  { id: "ivoclar", label: "Ivoclar" },
  { id: "wiedent", label: "Wiedent" },
  { id: "dentex", label: "Dentex" },
  { id: "major", label: "Major Dental" },
  { id: "hansen", label: "Hansen Dental" },
  { id: "mgm", label: "MGM System" },
  { id: "formed", label: "Formed" },
];

export function teethManufacturerLabel(id: TeethManufacturer | null | undefined): string | null {
  if (!id) return null;
  return TEETH_MANUFACTURERS.find((m) => m.id === id)?.label ?? null;
}

export function isTeethManufacturer(value: string): value is TeethManufacturer {
  return (
    value === "ivoclar" ||
    value === "wiedent" ||
    value === "dentex" ||
    value === "major" ||
    value === "hansen" ||
    value === "mgm" ||
    value === "formed"
  );
}

export function parseTeethManufacturer(value: unknown): TeethManufacturer | null {
  if (typeof value !== "string") return null;
  return isTeethManufacturer(value) ? value : null;
}

export function parseTeethKind(value: unknown): TeethKind | null {
  if (value === "anterior" || value === "posterior") return value;
  return null;
}

const ANTERIOR_KEYWORDS = ["przednie", "przód", "przod", "przedni", "front"];
const POSTERIOR_KEYWORDS = ["boczne", "boczny", "tylne", "tylny", "tył", "tyl", "back"];

export function detectTeethKind(name: string): TeethKind | null {
  const lower = name.toLowerCase();
  if (ANTERIOR_KEYWORDS.some((kw) => lower.includes(kw))) return "anterior";
  if (POSTERIOR_KEYWORDS.some((kw) => lower.includes(kw))) return "posterior";
  return null;
}

export const TEETH_COLORS: Record<TeethManufacturer, string[]> = {
  ivoclar: [
    "A1", "A2", "A3", "A3.5", "A4",
    "B1", "B2", "B3", "B4",
    "C1", "C2", "C3", "C4",
    "D2", "D3", "D4",
    "BL1", "BL2", "BL3", "BL4",
  ],
  wiedent: [
    "A1", "A2", "A3", "A3.5", "A4",
    "B1", "B2", "B3", "B4",
    "C1", "C2", "C3", "C4",
    "D2", "D3", "D4",
    "G1", "G2", "G3",
    "N2", "N3", "N5",
    "R1", "R3", "R5",
    "0M1", "0M3",
  ],
  dentex: [
    "A1", "A2", "A3", "A3.5", "A4",
    "B1", "B2", "B3", "B4",
    "C1", "C2", "C3", "C4",
    "D2", "D3", "D4",
  ],
  major: [
    "A1", "A2", "A3", "A3.5", "A4",
    "B1", "B2", "B3", "B4",
    "C1", "C2", "C3", "C4",
    "D2", "D3", "D4",
    "2C", "2D", "2E", "2N", "2P",
    "3D", "3M", "3N", "3P", "3R",
  ],
  hansen: [
    "A1", "A2", "A3", "A3.5", "A4",
    "B1", "B2", "B3", "B4",
    "C1", "C2", "C3", "C4",
    "D2", "D3", "D4",
  ],
  mgm: [
    "A1", "A2", "A3", "A3.5", "A4",
    "B1", "B2", "B3", "B4",
    "C1", "C2", "C3", "C4",
    "D2", "D3", "D4",
  ],
  formed: [
    "A1", "A2", "A3", "A3.5", "A4",
    "B1", "B2", "B3", "B4",
    "C1", "C2", "C3", "C4",
    "D2", "D3", "D4",
  ],
};

export type TeethMouldsByKind = {
  anterior: string[] | null;
  posterior: string[] | null;
};

export const TEETH_MOULDS: Record<TeethManufacturer, TeethMouldsByKind> = {
  ivoclar: {
    anterior: [
      "A11", "A12", "A13", "A14", "A15", "A17",
      "A22", "A24", "A24B", "A25", "A27",
      "A32", "A36",
      "A41", "A42", "A44", "A54", "A56", "A66", "A68",
    ],
    posterior: [
      "S61", "S62", "S63", "S71", "S72", "S73", "S81", "S82", "S83",
      "B61", "B62", "B63", "B71", "B72", "B73", "B81", "B82", "B83",
    ],
  },
  wiedent: {
    anterior: [
      "12", "13", "14", "15", "17", "18",
      "20", "21", "22", "23", "25", "26", "27", "28", "29",
      "31", "32", "33", "34", "35", "36", "37", "38", "39",
      "40", "41", "42", "43", "45", "47", "48", "49", "50",
    ],
    posterior: [
      "60", "62", "65", "70", "72", "74", "76", "77", "79", "80",
    ],
  },
  dentex: {
    anterior: [
      "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
      "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII",
      "XIX", "XX", "XXI", "XXII", "XXIII", "XXIV",
    ],
    posterior: [
      "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX",
    ],
  },
  major: {
    anterior: [
      "2", "5", "7A", "8A", "10", "12", "16", "17",
      "18A", "19A", "22", "24", "27A", "29A", "30A",
      "33A", "35A", "36", "37A", "38A", "39", "40A", "45A",
    ],
    posterior: null,
  },
  hansen: { anterior: null, posterior: null },
  mgm: { anterior: null, posterior: null },
  formed: { anterior: null, posterior: null },
};

export type TeethLineDetail = {
  position: number;
  color: string;
  mould?: string | null;
  jaw?: TeethJaw | null;
  kind?: TeethKind | null;
  /** @deprecated use mould instead */
  size?: string | null;
};

/** Zwraca listę fasonów/wzorów dla danego producenta i rodzaju zębów. */
export function toothMouldsFor(
  manufacturer: TeethManufacturer,
  kind: "anterior" | "posterior",
): readonly string[] {
  return TEETH_MOULDS[manufacturer][kind] ?? [];
}

export function hasMoulds(manufacturer: TeethManufacturer): boolean {
  const m = TEETH_MOULDS[manufacturer];
  return (m.anterior != null && m.anterior.length > 0) || (m.posterior != null && m.posterior.length > 0);
}

export function hasMouldsForKind(
  manufacturer: TeethManufacturer,
  kind: "anterior" | "posterior",
): boolean {
  const list = TEETH_MOULDS[manufacturer][kind];
  return list != null && list.length > 0;
}

export function teethColorsFor(manufacturer: TeethManufacturer): readonly string[] {
  return TEETH_COLORS[manufacturer];
}

/** @deprecated use toothMouldsFor */
export function teethMouldsFor(manufacturer: TeethManufacturer): readonly string[] {
  return TEETH_MOULDS[manufacturer].anterior ?? TEETH_MOULDS[manufacturer].posterior ?? [];
}

export function isTeethDetailComplete(
  detail: TeethLineDetail,
  manufacturer: TeethManufacturer,
): boolean {
  if (!detail.color.trim()) return false;
  if (!detail.jaw) return false;
  if (!detail.kind) return false;
  if (hasMouldsForKind(manufacturer, detail.kind) && !detail.mould?.trim()) return false;
  return true;
}

export function allTeethDetailsComplete(
  details: TeethLineDetail[] | undefined,
  manufacturer: TeethManufacturer | null | undefined,
  expectedCount: number,
): boolean {
  if (!manufacturer) return true;
  if (!details || details.length < expectedCount) return false;
  return details.slice(0, expectedCount).every((d) => isTeethDetailComplete(d, manufacturer));
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

export function groupTeethDetails(
  details: TeethLineDetail[] | undefined,
): { color: string; mould: string | null; jaw: TeethJaw | null; kind: TeethKind | null; count: number }[] {
  if (!details || details.length === 0) return [];
  const map = new Map<string, { color: string; mould: string | null; jaw: TeethJaw | null; kind: TeethKind | null; count: number }>();
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
