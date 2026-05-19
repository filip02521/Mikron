/**
 * Mapowanie arkusza „STATYSTYKI DOSTAW” (GAS v12) → tabela `delivery_stats`.
 *
 * | Arkusz (PL)              | Kolumna DB     | Znaczenie |
 * |--------------------------|----------------|-----------|
 * | DOSTAWCA                 | suppliers.name | Klucz — nazwa dostawcy |
 * | SUMA DNI (GŁÓWNE)        | main_sum       | Suma dni roboczych realizacji zamówień planowych (Główne) |
 * | LICZBA DOSTAW (GŁÓWNE)   | main_count     | Ile próbek (jedna na dostawcę + dzień zamówienia) |
 * | ŚREDNI CZAS (GŁÓWNE)     | main_avg       | round(main_sum / main_count) |
 * | SUMA DNI (POBOCZNE)      | side_sum       | Jak wyżej dla domówień (Poboczne) |
 * | LICZBA DOSTAW (POBOCZNE) | side_count     | Liczba próbek pobocznych |
 * | ŚREDNI CZAS (POBOCZNE)   | side_avg       | round(side_sum / side_count) |
 * | OSTATNIA AKTUALIZACJA    | updated_at     | Ostatnia zmiana wiersza |
 *
 * Ustawienia dostawcy (OSOBNO / ŁĄCZNIE) → `suppliers.stats_mode`:
 * - OSOBNO: ETA z main_avg lub side_avg wg typu zamówienia
 * - LACZNIE: średnia ważona (main_sum+side_sum)/(main_count+side_count) — jak w mailach GAS
 */

import type { DeliveryStats, StatsMode } from "@/types/database";

export type ParsedDeliveryStatsRow = {
  supplierName: string;
  main_sum: number | null;
  main_count: number | null;
  main_avg: number | null;
  side_sum: number | null;
  side_count: number | null;
  side_avg: number | null;
  updated_at: string | null;
};

export function combinedAvgDays(stats: DeliveryStats | null | undefined): number | null {
  if (!stats) return null;
  const sum = (stats.main_sum ?? 0) + (stats.side_sum ?? 0);
  const count = (stats.main_count ?? 0) + (stats.side_count ?? 0);
  if (count <= 0) return null;
  return Math.round(sum / count);
}

export function mainAvgDays(stats: DeliveryStats | null | undefined): number | null {
  if (!stats?.main_count || stats.main_avg == null) return null;
  return Number(stats.main_avg);
}

export function sideAvgDays(stats: DeliveryStats | null | undefined): number | null {
  if (!stats?.side_count || stats.side_avg == null) return null;
  return Number(stats.side_avg);
}

export function totalSampleCount(stats: DeliveryStats | null | undefined): number {
  if (!stats) return 0;
  return (stats.main_count ?? 0) + (stats.side_count ?? 0);
}

export function avgDaysForStatsMode(
  stats: DeliveryStats | null | undefined,
  statsMode: StatsMode,
  orderType: "Glowne" | "Poboczne" | "None" = "Poboczne"
): number | null {
  if (!stats) return null;
  if (statsMode === "LACZNIE") {
    return combinedAvgDays(stats);
  }
  if (orderType === "Glowne") return mainAvgDays(stats);
  if (orderType === "Poboczne") return sideAvgDays(stats);
  return mainAvgDays(stats) ?? sideAvgDays(stats);
}
