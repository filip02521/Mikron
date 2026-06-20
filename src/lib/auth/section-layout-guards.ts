import { requireAdmin, requireOperations, requireWarehouse } from "@/lib/auth";

/** Defense-in-depth obok proxy — sekcja /admin. */
export async function ensureAdminSection(): Promise<void> {
  await requireAdmin();
}

/** Panel operacji zakupowych (admin + zakupy). */
export async function ensureOperationsSection(): Promise<void> {
  await requireOperations();
}

/** Magazyn: kolejka, notatki magazynowe (admin + zakupy + magazyn). */
export async function ensureWarehouseSection(): Promise<void> {
  await requireWarehouse();
}
