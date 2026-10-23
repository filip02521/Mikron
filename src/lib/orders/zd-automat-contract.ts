/**
 * Kontrakt automatu ZD — polscy dostawcy (TASKS.md „Automat ZD — polscy dostawcy”, zadania 2/4/5/7).
 * Tylko typy i stałe, bez I/O: bezpieczne dla serwera i klienta.
 *
 * Właściciele znaczeń (jeden na pojęcie):
 * - `ZdProposalLineFlag` i `ZdAutoProposalLine.flags` — zadanie 4 (bezpieczniki) zapisuje; reszta tylko czyta.
 * - status `deferred` + `deferredReason` propozycji — zadanie 5 (minimum / darmowa dostawa).
 * - `ZdAbc`/`ZdXyz` i tabela `zd_sku_class` — zadanie 7.
 * - kraj dostawcy, `autoLevel`, `cutoffTime`, `freeShippingThreshold` — zadanie 2.
 */

/** Kod kraju Polska w słowniku Subiekta (`sl_Panstwo`, `adr_IdPanstwo`). */
export const SUBIEKT_COUNTRY_ID_POLAND = 1;

/** Flaga bezpiecznika na linii propozycji — linia z flagą wymaga akceptacji człowieka. */
export type ZdProposalLineFlag =
  /** stan + zamówienie > tempo × (dni celu + 30) */
  | "ceiling"
  /** jeden dokument > 60% sprzedaży 30 d i ilość > 2× (tempo 90 d × dni celu) */
  | "peak"
  /** ilość > 3× średniej z 4 ostatnich ZD tego towaru */
  | "jump"
  /** pierwsza sprzedaż < 13 tygodni temu i wartość linii > 500 zł */
  | "new_item"
  /** brak tempa, ceny albo czasu dostawy — ilość z fallbacku */
  | "missing_data";

/** Flaga całej propozycji (wartość ZD > 2× mediany 6 ostatnich ZD dostawcy). */
export type ZdProposalFlag = "order_value_jump";

export const ZD_PROPOSAL_LINE_FLAG_LABEL: Record<ZdProposalLineFlag, string> = {
  ceiling: "ponad sufit",
  peak: "pik sprzedaży",
  jump: "skok vs ostatnie ZD",
  new_item: "nowość",
  missing_data: "brak danych",
};

export type ZdAbc = "A" | "B" | "C";
/** N = nowość (pierwsza sprzedaż < 13 tygodni temu). */
export type ZdXyz = "X" | "Y" | "Z" | "N";

/** Wynik reguły minimum / darmowej dostawy dla jednej propozycji (zadanie 5). */
export type ZdProposalMinimumOutcome =
  | { kind: "ok" }
  /** Odłożona na kolejny cykl: poniżej minimum lub progu, bez linii pilnych. */
  | { kind: "deferred"; reason: string }
  /** Dopełniona do progu darmowej dostawy (≤ 15% brakującej wartości). */
  | { kind: "topped_up"; addedTwIds: number[]; reason: string };
