"use server";

import { requireMailCenterAccess } from "@/lib/auth/admin-modules";
import {
  getLatestMailLogForJob,
  getMailSendLogDetail,
  listMailSendLogs,
  loadAllMailJobs,
  loadMailJob,
  loadMailJobRecipients,
} from "@/lib/services/mail/mail-log";
import type { MailSendLog, MailSendStatus } from "@/types/database";

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

export type MailJobListEntry = {
  job: Awaited<ReturnType<typeof loadAllMailJobs>>[number];
  lastLog: MailSendLog | null;
};
