"use server";

// @service-role-ok — autoryzacja requireOperations("mutate") + rola admin/zakupy; zapis tylko tabel rol_*.

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireOperations } from "@/lib/auth";
import { hasDatabaseConfig } from "@/lib/db/pool";
import { getEmailSignature, getGmailConnection, sendGmailAsUser } from "@/lib/google/gmail-connections";
import { approveRolBatch, loadRolBatchById, reopenRolBatch, runRolScan, saveRolProgram, setRolInvoice, setRolLine } from "@/lib/rol/data";
import { buildRolBatchFiles } from "@/lib/rol/files";
import { ensureRolZd, sendRolMail } from "@/lib/rol/send";
import { loadIvoclarKhId, loadRolMailDefaults, rolSendStore, rolZdApi, sha256 } from "@/lib/rol/send-io";
import { parseRolMailInput, rolMailDraft, rolZdUwagi } from "@/lib/rol/send-rules";
import { rolSheetRows } from "@/lib/rol/sheet";
import { resolveSubiektIssuerId } from "@/lib/subiekt/api";
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

/** Rola i baza po requireOperations — wywoływane w ciele każdej akcji (reguła CodeQL widzi auth tylko tam). */
function assertRolReady(user: { role: string }) {
  assertRolEditor(user);
  if (!hasDatabaseConfig()) throw new Error("Brak konfiguracji bazy danych.");
}

/** Wspólna obsługa błędów i odświeżenia strony; autoryzację robi sama akcja w `run`. */
async function editRol(run: () => Promise<void>, fallback: string): Promise<Result> {
  try {
    await run();
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
    assertRolReady(await requireOperations("mutate"));
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
    assertRolReady(await requireOperations("mutate"));
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
  return editRol(async () => {
    const user = await requireOperations("mutate");
    assertRolReady(user);
    await approveRolBatch(batchIdOrThrow(batchId), user.id);
  }, "Nie udało się zatwierdzić listy.");
}

export async function actionRolReopen(batchId: string): Promise<Result> {
  return editRol(async () => {
    assertRolReady(await requireOperations("mutate"));
    await reopenRolBatch(batchIdOrThrow(batchId));
  }, "Nie udało się otworzyć listy do edycji.");
}

/** „Pobierz PDF-y ponownie”: zeruje nieudane próby i pobiera brakujące PDF-y FS w tle. */
export async function actionRolFetchPdfs(): Promise<Result> {
  return editRol(async () => {
    assertRolReady(await requireOperations("mutate"));
    await resetFailedRolPdfs();
    fetchPdfsInBackground();
  }, "Nie udało się zlecić pobrania PDF.");
}

// --- Wysyłka (plasterek 5): podgląd maila, ZD w Subiekcie, mail z Gmaila osoby. ---

export type RolMailPreview = {
  from: string | null;
  draft: { to: string; cc: string; subject: string; body: string };
  files: Array<{ name: string; bytes: number }>;
  missingPdf: string[];
  zd: { nr: string | null; uwagi: string; lines: Array<{ symbol: string; name: string; qty: number }> };
};

export async function actionRolPrepareMail(batchId: string): Promise<Result<{ preview: RolMailPreview }>> {
  try {
    const user = await requireOperations("mutate");
    assertRolEditor(user);
    if (!hasDatabaseConfig()) return { ok: false, error: "Brak konfiguracji bazy danych." };
    const id = batchIdOrThrow(batchId);
    const [found, files, defaults, conn, signature] = await Promise.all([
      loadRolBatchById(id),
      buildRolBatchFiles(id),
      loadRolMailDefaults(),
      getGmailConnection(user.id).catch(() => null),
      getEmailSignature(user.id).catch(() => ""),
    ]);
    if (!found || !files) return { ok: false, error: "Nie znaleziono zgłoszenia — odśwież stronę." };
    const draft = rolMailDraft({ program: found.program, period: found.batch.period, defaults, signature });
    return {
      ok: true,
      preview: {
        from: conn?.email ?? null,
        draft: { to: draft.to.join(", "), cc: draft.cc.join(", "), subject: draft.subject, body: draft.body },
        files: [files.sheet, ...files.pdfs].map((f) => ({ name: f.name, bytes: f.content.length })),
        missingPdf: files.missingPdf,
        zd: {
          nr: found.batch.zdNr,
          uwagi: rolZdUwagi(found.program.label, found.batch.period),
          lines: rolSheetRows(found.batch),
        },
      },
    };
  } catch (e) {
    return { ok: false, error: userFacingErrorText(e, "Nie udało się przygotować maila.") };
  }
}

export async function actionRolEnsureZd(batchId: string): Promise<Result<{ zdNr: string }>> {
  try {
    const user = await requireOperations("mutate");
    assertRolEditor(user);
    if (!hasDatabaseConfig()) return { ok: false, error: "Brak konfiguracji bazy danych." };
    const id = batchIdOrThrow(batchId);
    const [found, files, ivoclarKhId, personelId] = await Promise.all([
      loadRolBatchById(id),
      buildRolBatchFiles(id),
      loadIvoclarKhId(),
      resolveSubiektIssuerId(user.email).catch(() => null),
    ]);
    if (!found || !files) return { ok: false, error: "Nie znaleziono zgłoszenia — odśwież stronę." };
    const res = await ensureRolZd(
      {
        batch: found.batch,
        programLabel: found.program.label,
        missingPdf: files.missingPdf,
        ivoclarKhId,
        personelId,
        todayKey: warsawNowParts().dateKey,
      },
      rolSendStore,
      rolZdApi
    );
    revalidatePath(ASYSTENT_PATH);
    return res.ok ? { ok: true, zdNr: res.zdNr } : res;
  } catch (e) {
    revalidatePath(ASYSTENT_PATH);
    return { ok: false, error: userFacingErrorText(e, "Nie udało się utworzyć ZD w Subiekcie. Sprawdź w Subiekcie, czy ZD nie powstała, zanim spróbujesz ponownie.") };
  }
}

export async function actionRolSendMail(
  batchId: string,
  mail: { to: string; cc: string; subject: string; body: string }
): Promise<Result<{ from: string }>> {
  try {
    const user = await requireOperations("mutate");
    assertRolEditor(user);
    if (!hasDatabaseConfig()) return { ok: false, error: "Brak konfiguracji bazy danych." };
    const id = batchIdOrThrow(batchId);
    const parsed = parseRolMailInput({
      to: String(mail?.to ?? ""),
      cc: String(mail?.cc ?? ""),
      subject: String(mail?.subject ?? ""),
      body: String(mail?.body ?? ""),
    });
    if (!parsed.ok) return parsed;
    const [found, files] = await Promise.all([loadRolBatchById(id), buildRolBatchFiles(id)]);
    if (!found || !files) return { ok: false, error: "Nie znaleziono zgłoszenia — odśwież stronę." };
    const res = await sendRolMail(
      { batch: found.batch, files, mail: parsed.value, userId: user.id, sha256 },
      rolSendStore,
      (input) => sendGmailAsUser({ ...input, kind: "supplier_order" })
    );
    revalidatePath(ASYSTENT_PATH);
    return res;
  } catch (e) {
    return { ok: false, error: userFacingErrorText(e, "Nie udało się wysłać maila.") };
  }
}
