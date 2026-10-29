"use server";

// @service-role-ok — autoryzacja requireOperations("mutate") + rola admin/zakupy; zapis tylko tabel rol_*.

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireOperations } from "@/lib/auth";
import { hasDatabaseConfig } from "@/lib/db/pool";
import { approveRolBatch, reopenRolBatch, runRolScan, saveRolProgram, setRolInvoice, setRolLine } from "@/lib/rol/data";
import { fetchMissingRolPdfs, resetFailedRolPdfs } from "@/lib/rol/pdfs";
import { parseRolProgramInput, type RolProgramInput } from "@/lib/rol/program";
import { parseRolCatalogNo, parseRolQtyOverride } from "@/lib/rol/review";
import { isRolPeriod } from "@/lib/rol/scan";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { warsawNowParts } from "@/lib/time/warsaw";

const ASYSTENT_PATH = "/zakupy/asystent";
/** PDF FS ok. 45 s na fakturę — w tle po odpowiedzi, z budżetem jak inne zadania w tle. */
const PDF_BUDGET_MS = 12 * 60 * 1000;

function fetchPdfsInBackground() {
  after(async () => {
    try {
      await fetchMissingRolPdfs({ budgetMs: PDF_BUDGET_MS });
    } catch (e) {
      console.error("[rol] PDF FS w tle", e);
    }
  });
}

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
    fetchPdfsInBackground();
    revalidatePath(ASYSTENT_PATH);
    return { ok: true, fsChecked: res.fsChecked, changed: res.changed };
  } catch (e) {
    return { ok: false, error: userFacingErrorText(e, "Nie udało się sprawdzić FS w Subiekcie. Spróbuj ponownie.") };
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function batchIdOrThrow(raw: string): string {
  const id = String(raw ?? "").trim();
  if (!UUID_RE.test(id)) throw new Error("Nieprawidłowy identyfikator zgłoszenia.");
  return id;
}

function positiveIntOrThrow(raw: unknown, what: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Nieprawidłowy identyfikator ${what}.`);
  return n;
}

async function editRol(run: (userId: string) => Promise<void>, fallback: string): Promise<Result> {
  try {
    const user = await requireOperations("mutate");
    assertRolEditor(user);
    if (!hasDatabaseConfig()) return { ok: false, error: "Brak konfiguracji bazy danych." };
    await run(user.id);
    revalidatePath(ASYSTENT_PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userFacingErrorText(e, fallback) };
  }
}

export async function actionRolSetInvoice(input: {
  batchId: string;
  fsDokId: number;
  mode: "exclude" | "include" | "assign";
  reason?: string;
}): Promise<Result> {
  return editRol(async () => {
    if (!["exclude", "include", "assign"].includes(input.mode)) throw new Error("Nieznana zmiana FS.");
    await setRolInvoice({
      batchId: batchIdOrThrow(input.batchId),
      fsDokId: positiveIntOrThrow(input.fsDokId, "FS"),
      mode: input.mode,
      reason: typeof input.reason === "string" ? input.reason : undefined,
    });
  }, "Nie udało się zmienić FS w zgłoszeniu.");
}

export async function actionRolSetLine(input: {
  batchId: string;
  lineId: number;
  excluded?: boolean;
  qty?: string;
  catalogNo?: string;
}): Promise<Result> {
  return editRol(async () => {
    let qtyOverride: number | null | undefined;
    if (input.qty !== undefined) {
      const q = parseRolQtyOverride(String(input.qty));
      if (!q.ok) throw new Error(q.error);
      qtyOverride = q.value;
    }
    let catalogNo: string | undefined;
    if (input.catalogNo !== undefined) {
      const c = parseRolCatalogNo(String(input.catalogNo));
      if (!c.ok) throw new Error(c.error);
      catalogNo = c.value;
    }
    await setRolLine({
      batchId: batchIdOrThrow(input.batchId),
      lineId: positiveIntOrThrow(input.lineId, "pozycji"),
      excluded: typeof input.excluded === "boolean" ? input.excluded : undefined,
      qtyOverride,
      catalogNo,
    });
  }, "Nie udało się zmienić pozycji.");
}

export async function actionRolApprove(batchId: string): Promise<Result> {
  return editRol((userId) => approveRolBatch(batchIdOrThrow(batchId), userId), "Nie udało się zatwierdzić listy.");
}

export async function actionRolReopen(batchId: string): Promise<Result> {
  return editRol(() => reopenRolBatch(batchIdOrThrow(batchId)), "Nie udało się otworzyć listy do edycji.");
}

/** „Pobierz PDF-y ponownie”: zeruje nieudane próby i pobiera brakujące PDF-y FS w tle. */
export async function actionRolFetchPdfs(): Promise<Result> {
  return editRol(async () => {
    await resetFailedRolPdfs();
    fetchPdfsInBackground();
  }, "Nie udało się zlecić pobrania PDF.");
}
