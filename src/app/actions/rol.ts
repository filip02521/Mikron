"use server";

// @service-role-ok — autoryzacja requireOperations("mutate") + rola admin/zakupy; zapis tylko tabel rol_*.

import { revalidatePath } from "next/cache";
import { requireOperations } from "@/lib/auth";
import { hasDatabaseConfig } from "@/lib/db/pool";
import { runRolScan, saveRolProgram } from "@/lib/rol/data";
import { parseRolProgramInput, type RolProgramInput } from "@/lib/rol/program";
import { isRolPeriod } from "@/lib/rol/scan";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { warsawNowParts } from "@/lib/time/warsaw";

const ASYSTENT_PATH = "/zakupy/asystent";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function assertRolEditor(user: { role: string }) {
  if (user.role !== "admin" && user.role !== "zakupy") {
    throw new Error("Zgłoszenia ROL są dostępne dla działu zakupów.");
  }
}

export async function actionSaveRolProgram(input: RolProgramInput): Promise<Result<{ id: string }>> {
  try {
    const user = await requireOperations("mutate");
    assertRolEditor(user);
    if (!hasDatabaseConfig()) return { ok: false, error: "Brak konfiguracji bazy danych." };
    const parsed = parseRolProgramInput(input);
    if (!parsed.ok) return parsed;
    const id = await saveRolProgram(parsed.value, user.id);
    revalidatePath(ASYSTENT_PATH);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: userFacingErrorText(e, "Nie udało się zapisać klienta ROL.") };
  }
}

export async function actionScanRolMonth(period: string): Promise<Result<{ fsChecked: number; changed: number }>> {
  try {
    assertRolEditor(await requireOperations("mutate"));
    if (!hasDatabaseConfig()) return { ok: false, error: "Brak konfiguracji bazy danych." };
    if (!isRolPeriod(period)) return { ok: false, error: "Nieprawidłowy miesiąc." };
    const todayKey = warsawNowParts().dateKey;
    if (period > todayKey) return { ok: false, error: "Ten miesiąc jeszcze się nie zaczął." };
    const res = await runRolScan({ period, todayKey });
    revalidatePath(ASYSTENT_PATH);
    return { ok: true, fsChecked: res.fsChecked, changed: res.changed };
  } catch (e) {
    return { ok: false, error: userFacingErrorText(e, "Nie udało się sprawdzić FS w Subiekcie. Spróbuj ponownie.") };
  }
}
