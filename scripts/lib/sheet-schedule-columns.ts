/**
 * Mapowanie kolumn arkusza POLSKA / ZAGRANICA / IMPORT (jak w Google Sheets).
 * H = PRZESUNIĘCIE — data ręcznego przesunięcia zamówienia (niezależnie od G).
 * G = DATA KOLEJNEGO — widoczna data następnego zamówienia w arkuszu.
 */
export const SHEET_SCHEDULE_COL = {
  DOSTAWCA: 0,
  KIEROWCA_MIKRAN: 1,
  ZLEC_ODBIOR: 2,
  SPOSOB: 3,
  DODATKOWE: 4,
  DATA_ZAMOWIENIA: 5,
  DATA_KOLEJNEGO: 6,
  PRZESUNIECIE: 7,
  ZAPAS: 8,
  UWAGI_URLOPOWE: 9,
} as const;

export const SHEET_SCHEDULE_HEADER_ALIASES = {
  DATA_ZAMOWIENIA: ["DATA ZAMÓWIENIA", "DATA ZAMOWIENIA", "DATA ZAM"],
  DATA_KOLEJNEGO: ["DATA KOLEJNEGO", "DATA KOLEJNA", "KOLEJNE"],
  PRZESUNIECIE: ["PRZESUNIĘCIE", "PRZESUNIECIE", "PRZESUNIETE"],
} as const;
