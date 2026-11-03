"use server";

import { revalidatePath } from "next/cache";
import { requireServicePanel } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";
import {
  endLoanerService,
  extendLoanerUnit,
  fetchLoanerCodes,
  insertLoanerUnit,
  issueLoanerUnit,
  LoanerStateError,
  returnLoanerUnit,
  startLoanerService,
  type LoanerActor,
} from "@/lib/data/service-loaners";
import {
  LOANER_CONDITIONS,
  nextLoanerCode,
  normalizeLoanerCode,
  parseDateOnly,
  toDateOnly,
} from "@/lib/orders/service-loaners";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

export type LoanerActionResult = { ok: true; message: string } | { ok: false; message: string };

const LOANERS_PATH = "/serwis/zamienniki";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function actorOf(user: SessionUser): LoanerActor {
  const name = user.email.split("@")[0] || user.email;
  return { id: user.id === "dev" ? null : user.id, name };
}

function text(v: unknown, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

function unitId(v: unknown): string {
  const id = String(v ?? "").trim();
  if (!UUID_RE.test(id)) throw new LoanerStateError("Nieprawidłowy egzemplarz. Odśwież listę.");
  return id;
}

function condition(v: unknown): string {
  const c = text(v, 40);
  return (LOANER_CONDITIONS as readonly string[]).includes(c) ? c : "dobry";
}

/** Data zwrotu: od dziś do roku w przód. */
function returnDate(v: unknown): string {
  const raw = text(v, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new LoanerStateError("Wybierz datę planowanego zwrotu.");
  const d = parseDateOnly(raw);
  const today = new Date();
  const min = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const max = new Date(min.getFullYear() + 1, min.getMonth(), min.getDate());
  if (d < min) throw new LoanerStateError("Data zwrotu nie może być w przeszłości.");
  if (d > max) throw new LoanerStateError("Data zwrotu może być najwyżej rok od dziś.");
  return toDateOnly(d);
}

async function run(fn: () => Promise<string>): Promise<LoanerActionResult> {
  try {
    const message = await fn();
    revalidatePath(LOANERS_PATH);
    return { ok: true, message };
  } catch (e) {
    if (e instanceof LoanerStateError) return { ok: false, message: e.message };
    return { ok: false, message: userFacingErrorText(e, "Nie udało się zapisać. Spróbuj ponownie.") };
  }
}

export async function actionSuggestLoanerCode(): Promise<string> {
  await requireServicePanel("read");
  return nextLoanerCode(await fetchLoanerCodes());
}

export async function actionAddLoanerUnit(input: {
  code: string;
  serialNo?: string | null;
  twId: number;
  twSymbol?: string | null;
  twName: string;
  condition?: string;
  note?: string;
}): Promise<LoanerActionResult> {
  const user = await requireServicePanel("mutate");
  return run(async () => {
    const code = normalizeLoanerCode(text(input.code, 60));
    if (!code) throw new LoanerStateError("Wpisz numer egzemplarza (np. ZAST-005 albo numer seryjny).");
    const twId = Math.trunc(Number(input.twId));
    if (!Number.isSafeInteger(twId) || twId <= 0) throw new LoanerStateError("Wybierz towar z Subiekta.");
    const twName = text(input.twName, 200);
    if (!twName) throw new LoanerStateError("Wybierz towar z Subiekta.");
    await insertLoanerUnit(
      {
        code,
        serialNo: text(input.serialNo, 80) || null,
        twId,
        twSymbol: text(input.twSymbol, 80) || null,
        twName,
        condition: condition(input.condition),
        note: text(input.note, 300),
      },
      actorOf(user)
    );
    return `Dodano ${code} do puli zamienników.`;
  });
}

export async function actionIssueLoaner(input: {
  unitId: string;
  khId?: number | null;
  clientName: string;
  clientPhone?: string | null;
  plannedReturn: string;
  note?: string;
}): Promise<LoanerActionResult> {
  const user = await requireServicePanel("mutate");
  return run(async () => {
    const clientName = text(input.clientName, 200);
    if (!clientName) throw new LoanerStateError("Wybierz klienta.");
    const kh = Math.trunc(Number(input.khId));
    const u = await issueLoanerUnit(
      {
        unitId: unitId(input.unitId),
        khId: Number.isSafeInteger(kh) && kh > 0 ? kh : null,
        clientName,
        clientPhone: text(input.clientPhone, 40) || null,
        plannedReturn: returnDate(input.plannedReturn),
        note: text(input.note, 300),
      },
      actorOf(user)
    );
    return `Wydano ${u.code} dla ${clientName}.`;
  });
}

export async function actionReturnLoaner(input: {
  unitId: string;
  condition: string;
  needsService: boolean;
  note?: string;
}): Promise<LoanerActionResult> {
  const user = await requireServicePanel("mutate");
  return run(async () => {
    const u = await returnLoanerUnit(
      { unitId: unitId(input.unitId), condition: condition(input.condition), needsService: Boolean(input.needsService), note: text(input.note, 300) },
      actorOf(user)
    );
    return input.needsService ? `Przyjęto ${u.code}. Egzemplarz czeka na przegląd.` : `Przyjęto ${u.code}. Wrócił na stan.`;
  });
}

export async function actionExtendLoaner(input: { unitId: string; plannedReturn: string }): Promise<LoanerActionResult> {
  const user = await requireServicePanel("mutate");
  return run(async () => {
    const date = returnDate(input.plannedReturn);
    const u = await extendLoanerUnit({ unitId: unitId(input.unitId), plannedReturn: date }, actorOf(user));
    return `Nowy termin zwrotu ${u.code}: ${date.split("-").reverse().join(".")}.`;
  });
}

export async function actionStartLoanerService(input: { unitId: string; note?: string }): Promise<LoanerActionResult> {
  const user = await requireServicePanel("mutate");
  return run(async () => {
    const u = await startLoanerService({ unitId: unitId(input.unitId), note: text(input.note, 300) }, actorOf(user));
    return `${u.code} oznaczony do przeglądu.`;
  });
}

export async function actionEndLoanerService(input: { unitId: string; condition: string; note?: string }): Promise<LoanerActionResult> {
  const user = await requireServicePanel("mutate");
  return run(async () => {
    const u = await endLoanerService(
      { unitId: unitId(input.unitId), condition: condition(input.condition), note: text(input.note, 300) },
      actorOf(user)
    );
    return `Przegląd ${u.code} zakończony. Egzemplarz jest na stanie.`;
  });
}
