"use server";

import { revalidatePath } from "next/cache";
import { requireMailCenterAccess, requireMailCenterForMutation } from "@/lib/auth/admin-modules";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { isValidEmail } from "@/lib/security/text-limits";
import {
  deleteMailJobRecipient,
  getLatestMailLogForJob,
  getMailSendLogDetail,
  listMailSendLogs,
  loadAllMailJobs,
  loadMailJob,
  loadMailJobRecipients,
  setMailJobEnabled,
  upsertMailJobRecipient,
} from "@/lib/services/mail/mail-log";
import {
  IVOCLAR_WEEKLY_JOB_ID,
  previewIvoclarWeeklyMail,
  runIvoclarWeeklyMail,
} from "@/lib/services/mail/run-ivoclar-weekly-mail";
import type { MailJobRecipient, MailSendLog, MailSendStatus } from "@/types/database";

function revalidateMailPaths(jobId?: string) {
  revalidatePath("/admin/mail");
  if (jobId) revalidatePath(`/admin/mail/${jobId}`);
}

export async function actionListMailJobs() {
  await requireMailCenterAccess();
  const jobs = await loadAllMailJobs();
  const enriched = await Promise.all(
    jobs.map(async (job) => {
      const lastLog = await getLatestMailLogForJob(job.id);
      return { job, lastLog };
    })
  );
  return enriched;
}

export async function actionGetMailJob(jobId: string) {
  await requireMailCenterAccess();
  const [job, recipients, logs] = await Promise.all([
    loadMailJob(jobId),
    loadMailJobRecipients(jobId),
    listMailSendLogs({ jobId, limit: 20 }),
  ]);
  if (!job) return { ok: false as const, message: "Nie znaleziono joba" };
  const lastLog = logs[0] ?? null;
  return { ok: true as const, job, recipients, logs, lastLog };
}

export async function actionListMailLogs(input?: {
  jobId?: string;
  status?: MailSendStatus;
  limit?: number;
}) {
  await requireMailCenterAccess();
  const logs = await listMailSendLogs({
    jobId: input?.jobId,
    status: input?.status,
    limit: input?.limit ?? 30,
  });
  return logs;
}

export async function actionGetMailLogDetail(logId: string) {
  await requireMailCenterAccess();
  const detail = await getMailSendLogDetail(logId);
  if (!detail) return { ok: false as const, message: "Nie znaleziono wpisu logu" };
  return { ok: true as const, ...detail };
}

export async function actionSetMailJobEnabled(jobId: string, enabled: boolean) {
  await requireMailCenterForMutation();
  const ok = await setMailJobEnabled(jobId, enabled);
  revalidateMailPaths(jobId);
  return ok ? { success: true } : { error: "Nie udało się zapisać" };
}

export async function actionUpsertMailRecipient(input: {
  id?: string;
  jobId: string;
  email: string;
  displayName?: string | null;
  recipientRole: MailJobRecipient["recipient_role"];
  enabled: boolean;
  sortOrder: number;
}) {
  await requireMailCenterForMutation();
  const email = input.email.trim().toLowerCase();
  if (!isValidEmail(email)) {
    return { error: "Nieprawidłowy adres e-mail" };
  }
  const result = await upsertMailJobRecipient({
    id: input.id,
    job_id: input.jobId,
    email,
    display_name: input.displayName,
    recipient_role: input.recipientRole,
    enabled: input.enabled,
    sort_order: input.sortOrder,
  });
  if (!result.ok) return { error: result.error };
  revalidateMailPaths(input.jobId);
  return { success: true, id: result.id };
}

export async function actionDeleteMailRecipient(id: string, jobId: string) {
  await requireMailCenterForMutation();
  const ok = await deleteMailJobRecipient(id);
  revalidateMailPaths(jobId);
  return ok ? { success: true } : { error: "Nie udało się usunąć" };
}

export async function actionPreviewMailJob(jobId: string) {
  await requireMailCenterForMutation();
  if (jobId !== IVOCLAR_WEEKLY_JOB_ID) {
    return { ok: false as const, message: "Podgląd dostępny tylko dla Ivoclar weekly" };
  }
  try {
    const preview = await previewIvoclarWeeklyMail();
    if (!preview.ok) return { ok: false as const, message: preview.error };
    return { ok: true as const, preview };
  } catch (e) {
    return {
      ok: false as const,
      message: userFacingErrorText(e, "Nie udało się wygenerować podglądu"),
    };
  }
}

export async function actionSendMailJobTest(jobId: string) {
  await requireMailCenterForMutation();
  if (jobId !== IVOCLAR_WEEKLY_JOB_ID) {
    return { error: "Test dostępny tylko dla Ivoclar weekly" };
  }
  try {
    const result = await runIvoclarWeeklyMail({
      trigger: "test",
      skipIdempotency: true,
    });
    revalidateMailPaths(jobId);
    if (!result.ok) return { error: result.error };
    return { success: true, ...result };
  } catch (e) {
    return { error: userFacingErrorText(e, "Wysyłka testowa nie powiodła się") };
  }
}

export async function actionSendMailJobNow(jobId: string, force = false) {
  const user = await requireMailCenterForMutation();
  if (jobId !== IVOCLAR_WEEKLY_JOB_ID) {
    return { error: "Wysyłka dostępna tylko dla Ivoclar weekly" };
  }
  try {
    const result = await runIvoclarWeeklyMail({
      trigger: "manual",
      triggeredBy: user.id,
      skipIdempotency: force,
    });
    revalidateMailPaths(jobId);
    if (!result.ok) return { error: result.error };
    if (result.skipped && result.skipReason === "already_sent" && !force) {
      return {
        error: "Ten tydzień został już wysłany. Użyj „Wyślij ponownie (force)”.",
        skipped: true,
      };
    }
    return { success: true, ...result };
  } catch (e) {
    return { error: userFacingErrorText(e, "Wysyłka nie powiodła się") };
  }
}

export type MailJobListEntry = {
  job: Awaited<ReturnType<typeof loadAllMailJobs>>[number];
  lastLog: MailSendLog | null;
};
