/** Stałe zgłoszeń ROL bezpieczne dla klienta i serwera (bez importów Node i bazy). */

/** FS pasuje do dwóch klientów ROL naraz — nie trafia do żadnej paczki bez decyzji. */
export const ROL_CONFLICT_REASON = "FS pasuje do dwóch klientów ROL — do decyzji";

/** Konflikt rozstrzygnięty na korzyść tego klienta (FS włączona) — znacznik, żeby skan go nie cofnął. */
export const ROL_ASSIGNED_HERE_REASON = "Przypisana do tego klienta";

export const ROL_FREQUENCIES = ["month", "2weeks", "week"] as const;
/** Co ile klient dostaje raport. Miesięczny idzie zawsze 1. dnia; krótsze są dodatkowe. */
export type RolFrequency = (typeof ROL_FREQUENCIES)[number];

export const ROL_FREQUENCY_LABEL: Record<RolFrequency, string> = {
  month: "miesiąc",
  "2weeks": "2 tygodnie",
  week: "tydzień",
};
