/** Mapuje nazwy kolorów zębów (VITA, Chromascop, etc.) na kolory CSS dla podglądu. */

const VITA_SHADES: Record<string, string> = {
  A1: "#E8D5B7",
  A2: "#E0C9A6",
  A3: "#D4B896",
  "A3.5": "#C9A886",
  A4: "#BE9876",
  B1: "#EDE0C4",
  B2: "#E2D0B0",
  B3: "#D5C09C",
  B4: "#C8B088",
  C1: "#E5DBC8",
  C2: "#DAD0BC",
  C3: "#CDC2A8",
  C4: "#C0B494",
  D2: "#E6D8C0",
  D3: "#DCCFB4",
  D4: "#D2C4A8",
  BL1: "#F5F0E8",
  BL2: "#F0EAE0",
  BL3: "#EBE4D8",
  BL4: "#E6DFD0",
};

const WIEDENT_W_SHADES: Record<string, string> = {
  G1: "#E8D5B7",
  G2: "#DFC9A4",
  G3: "#D4BC94",
  N2: "#E2D0B0",
  N3: "#D5C09C",
  N5: "#C0A880",
  R1: "#E5C5A8",
  R3: "#D4A888",
  R5: "#C0906A",
};

const OM_SHADES: Record<string, string> = {
  OM1: "#F0EAE0",
  OM3: "#E0D5C8",
  "0M1": "#F0EAE0",
  "0M3": "#E0D5C8",
};

const VITA_V_SHADES: Record<string, string> = {
  A1V: "#E8D5B7",
  A2V: "#E0C9A6",
  A3V: "#D4B896",
  "A3.5V": "#C9A886",
  B1V: "#EDE0C4",
  B2V: "#E2D0B0",
  B3V: "#D5C09C",
  B4V: "#C8B088",
  C1V: "#E5DBC8",
  C2V: "#DAD0BC",
  C3V: "#CDC2A8",
  D2V: "#E6D8C0",
  D3V: "#DCCFB4",
  D4V: "#D2C4A8",
};

const ALL_SHADES: Record<string, string> = {
  ...VITA_SHADES,
  ...WIEDENT_W_SHADES,
  ...OM_SHADES,
  ...VITA_V_SHADES,
};

/** Zwraca kolor CSS dla nazwy odcienia zęba, lub null jeśli nie znaleziono. */
export function teethColorSwatch(color: string): string | null {
  const key = color.trim().toUpperCase();
  if (!key) return null;
  if (ALL_SHADES[key]) return ALL_SHADES[key];
  if (key.startsWith("A") || key.startsWith("B") || key.startsWith("C") || key.startsWith("D")) {
    const base = key.replace(/V$/, "").replace(/^0/, "O");
    if (ALL_SHADES[base]) return ALL_SHADES[base];
  }
  return null;
}
