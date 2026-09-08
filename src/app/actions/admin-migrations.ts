"use server";

import { requireAdmin } from "@/lib/auth";
import {
  getMigrationStatus,
  applyMigration,
  applyAllPendingMigrations,
  type MigrationApplyResult,
  type MigrationStatus,
} from "@/lib/db/migrations";

/**
 * Zwraca status migracji: oczekujące pliki + liczba zastosowanych.
 * Dostęp: admin + operations (panel admina).
 */
export async function actionGetMigrationStatus(): Promise<MigrationStatus> {
  await requireAdmin();
  return getMigrationStatus();
}

/**
 * Aplikuje pojedynczą migrację po nazwie pliku.
 * Dostęp: admin (mutacja schematu).
 */
export async function actionApplyMigration(
  filename: string,
): Promise<MigrationApplyResult> {
  await requireAdmin();
  return applyMigration(filename);
}

/**
 * Aplikuje wszystkie oczekujące migracje sekwencyjnie.
 * Zatrzymuje się przy pierwszym błędzie i zwraca wyniki do tego miejsca.
 * Dostęp: admin (mutacja schematu).
 */
export async function actionApplyAllPendingMigrations(): Promise<
  MigrationApplyResult[]
> {
  await requireAdmin();
  return applyAllPendingMigrations();
}
