/** Stałe zgłoszeń ROL bezpieczne dla klienta i serwera (bez importów Node i bazy). */

/** FS pasuje do dwóch klientów ROL naraz — nie trafia do żadnej paczki bez decyzji. */
export const ROL_CONFLICT_REASON = "FS pasuje do dwóch klientów ROL — do decyzji";

/** Konflikt rozstrzygnięty na korzyść tego klienta (FS włączona) — znacznik, żeby skan go nie cofnął. */
export const ROL_ASSIGNED_HERE_REASON = "Przypisana do tego klienta";
