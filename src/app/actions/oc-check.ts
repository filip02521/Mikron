"use server";

// @service-role-ok — autoryzacja requireOperations("mutate") + rola admin/zakupy; zapis tylko tabel oc_checks*.

import { revalidatePath } from "next/cache";
import { requireOperations } from "@/lib/auth";
import { createAdminClient, hasDatabaseConfig } from "@/lib/db/admin";
import { parseOcImport } from "@/lib/oc-check/import";
import { importOcChecks, setOcCheckResolved } from "@/lib/oc-check/data";

const ASYSTENT_PATH = "/zakupy/asystent";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IMPORT_CHARS = 2_000_000;

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function requireOcEditor() {
  const user = await requireOperations("mutate");
  if (user.role !== "admin" && user.role !== "zakupy") {
    throw new Error("Kontrola OC jest dostępna dla działu zakupów.");
  }
  return user;
}

function errorText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export async function actionImportOcChecks(json: string): Promise<Result<{ created: number; updated: number }>> {
  try {
    await requireOcEditor();
    if (!hasDatabaseConfig()) return { ok: false, error: "Brak konfiguracji bazy danych." };
    if (json.length > MAX_IMPORT_CHARS) return { ok: false, error: "Plik jest za duży." };
    const parsed = parseOcImport(json);
    if (!parsed.ok) return parsed;
    const summary = await importOcChecks(createAdminClient(), parsed.checks);
    revalidatePath(ASYSTENT_PATH);
    return { ok: true, ...summary };
  } catch (e) {
    return { ok: false, error: errorText(e, "Nie udało się zaimportować spraw.") };
  }
}

export async function actionSetOcCheckResolved(input: {
  id: string;
  resolved: boolean;
  note?: string;
}): Promise<Result> {
  try {
    const user = await requireOcEditor();
    const id = input.id.trim();
    if (!UUID_RE.test(id)) return { ok: false, error: "Nieprawidłowy identyfikator sprawy." };
    await setOcCheckResolved(createAdminClient(), {
      id,
      userId: user.id,
      resolved: input.resolved,
      note: (input.note ?? "").trim().slice(0, 500),
    });
    revalidatePath(ASYSTENT_PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorText(e, "Nie udało się zapisać decyzji.") };
  }
}
