/** Wspólne palety kolorów (VITA, Chromascop, skale producentów). */

export const VITA_AD = [
  "A1", "A2", "A3", "A3.5", "A4",
  "B1", "B2", "B3", "B4",
  "C1", "C2", "C3", "C4",
  "D2", "D3", "D4",
] as const;

export const VITA_AD_BL = [
  ...VITA_AD,
  "BL1", "BL2", "BL3", "BL4",
] as const;

export const IVOSTAR_CHROMASCOP = [
  "110/01", "120/1A", "130/2A", "140/1C",
  "210/2B", "220/1D", "230/1E", "240/2C",
  "310/3A", "320/5B", "330/2E", "340/3E",
  "410/4A", "420/6B", "430/4B", "440/6C",
  "510/6D", "520/4C", "530/3C", "540/4D",
] as const;

export const IVOSTAR_COLORS = [
  ...VITA_AD_BL,
  ...IVOSTAR_CHROMASCOP,
] as const;

export const WIEDENT_ALMAMISS_COLORS = [
  ...VITA_AD,
  "OM1", "OM3", "0M1", "0M3",
] as const;

export const WIEDENT_CLASSIC_COLORS = [
  "A1", "A2", "A3", "A3.5", "A4", "B2", "C2", "C3", "D3",
] as const;

export const WIEDENT_ESTETIC_W = [
  "G1", "G2", "G3", "N2", "N3", "N5", "R1", "R3", "R5",
] as const;

export const WIEDENT_ESTETIC_COLORS = [
  "A1", "A2", "B2", "B3",
  ...WIEDENT_ESTETIC_W,
] as const;

export const WIEDENT_ESTETIC_OM_COLORS = ["OM1", "OM3", "0M1", "0M3"] as const;

export const DENTEX_AMBERLUX_COLORS = [
  "A1", "A2", "B2", "B3", "C3", "D3", "D4",
  "G1", "G2", "N2", "N3", "R1", "R2", "R5",
] as const;

/** Skala DENTEX-V (wg katalogu — 14 odcieni z sufiksem V). */
export const DENTEX_V_COLORS = [
  "A1V", "A2V", "A3V", "A3.5V", "B1V", "B2V", "B3V", "B4V",
  "C1V", "C2V", "C3V", "D2V", "D3V", "D4V",
] as const;

export const MAJOR_DENT_COLORS = [
  ...VITA_AD,
  "2C", "2D", "2E", "2N", "2P", "3D", "3M", "3N", "3P", "3R",
] as const;

export const ENIGMALIFE_COLORS = [
  ...VITA_AD,
  "BL2", "BL3",
] as const;

/** Etykieta chipa „wpisz ręcznie” — wartość nie trafia do zapisu jako kolor/fason. */
export const TEETH_CHIP_OTHER = "Inny";
