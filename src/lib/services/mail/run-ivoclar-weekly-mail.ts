import { sendHtmlEmailWithAttachments } from "@/lib/services/email";
import {
  createMailSendIssues,
  createMailSendLog,
  getLatestSentLogForPeriod,
  hasSentMailForPeriod,
  loadMailJob,
  loadMailJobRecipients,
  nextMailAttemptNoForPeriodFamily,
  type MailRecipientSnapshot,
  updateMailSendLog,
} from "@/lib/services/mail/mail-log";
import {
  buildIvoclarWeeklyArtifacts,
  computeIvoclarWeeklyPeriod,
  forcedIvoclarWeeklyPeriodKey,
  ivoclarAttachmentManifest,
  ivoclarWeeklyEmailSubject,
  ivoclarWeeklyPeriodKeyForTrigger,
  ivoclarXlsxToBase64,
  renderIvoclarWeeklyEmailHtml,
} from "@/lib/services/mail/ivoclar-weekly-mail";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";
import type { MailSendEvent, MailSendTriggerKind } from "@/types/database";

export const IVOCLAR_WEEKLY_JOB_ID = "ivoclar_weekly";

export type RunIvoclarWeeklyMailOptions = {
  trigger: MailSendTriggerKind;
  triggeredBy?: string | null;
  todayDateKey?: string;
  skipIdempotency?: boolean;
  previewOnly?: boolean;
};

export type RunIvoclarWeeklyMailResult =
  | {
      ok: true;
      skipped?: boolean;
      skipReason?: string;
      logId?: string;
      status: "sent" | "failed" | "blocked" | "skipped" | "generating";
      hadWarnings?: boolean;
      issuesCount?: number;
      blockingIssueCount?: number;
    }
  | { ok: false; error: string };

function groupRecipients(recipients: Awaited<ReturnType<typeof loadMailJobRecipients>>) {
  const enabled = recipients.filter((r) => r.enabled);
  const snapshot: MailRecipientSnapshot[] = enabled.map((r) => ({
    email: r.email,
    display_name: r.display_name,
    recipient_role: r.recipient_role,
  }));
  return {
    snapshot,
    to: enabled.filter((r) => r.recipient_role === "to").map((r) => r.email),
    cc: enabled.filter((r) => r.recipient_role === "cc").map((r) => r.email),
    bcc: enabled.filter((r) => r.recipient_role === "bcc").map((r) => r.email),
  };
}

async function ensureLogUpdated(
  logId: string,
  patch: Parameters<typeof updateMailSendLog>[1]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const updated = await updateMailSendLog(logId, patch);
  if (!updated.ok) {
    return { ok: false, error: `Nie udało się zaktualizować logu ${logId}: ${updated.error}` };
  }
  return { ok: true };
}

export async function runIvoclarWeeklyMail(
  options: RunIvoclarWeeklyMailOptions
): Promise<RunIvoclarWeeklyMailResult> {
  const job = await loadMailJob(IVOCLAR_WEEKLY_JOB_ID);
  if (!job) return { ok: false, error: "Brak joba ivoclar_weekly w bazie" };
  if (!job.enabled && options.trigger === "cron") {
    return { ok: true, skipped: true, skipReason: "job_disabled", status: "skipped" };
  }

  const today = options.todayDateKey ?? todayDateKeyInWarsaw();
  const period = computeIvoclarWeeklyPeriod(today);
  const basePeriodKey = ivoclarWeeklyPeriodKeyForTrigger(period, options.trigger);
  const periodKey =
    options.trigger === "manual" && options.skipIdempotency
      ? forcedIvoclarWeeklyPeriodKey(period)
      : basePeriodKey;

  if (
    !options.skipIdempotency &&
    options.trigger !== "test" &&
    (await hasSentMailForPeriod(IVOCLAR_WEEKLY_JOB_ID, basePeriodKey))
  ) {
    return { ok: true, skipped: true, skipReason: "already_sent", status: "skipped" };
  }

  const recipients = groupRecipients(await loadMailJobRecipients(IVOCLAR_WEEKLY_JOB_ID));

  if (options.previewOnly) {
    const built = await buildIvoclarWeeklyArtifacts(today);
    if (!built.ok) {
      return { ok: false, error: built.error };
    }
    return {
      ok: true,
      status: "generating",
      hadWarnings: built.artifacts.issues.length > 0,
      issuesCount: built.artifacts.issues.length,
      blockingIssueCount: built.artifacts.issues.filter((i) => i.severity === "blocking").length,
    };
  }

  const attemptNo = await nextMailAttemptNoForPeriodFamily(IVOCLAR_WEEKLY_JOB_ID, basePeriodKey);
  const events: MailSendEvent[] = [
    { at: new Date().toISOString(), kind: "start", message: "Rozpoczęcie generacji raportu" },
  ];

  const logId = await createMailSendLog({
    job_id: IVOCLAR_WEEKLY_JOB_ID,
    period_key: periodKey,
    attempt_no: attemptNo,
    trigger_kind: options.trigger,
    triggered_by: options.triggeredBy ?? null,
    status: "generating",
    period_from: period.dataOd,
    period_to: period.dataDo,
    recipient_snapshot: recipients.snapshot,
    events,
  });

  if (!logId) return { ok: false, error: "Nie udało się utworzyć logu wysyłki" };

  if (!recipients.to.length) {
    events.push({
      at: new Date().toISOString(),
      kind: "blocked",
      message: "Brak aktywnych odbiorców TO",
    });
    const issuesSaved = await createMailSendIssues(logId, [
      {
        severity: "blocking",
        code: "no_recipients",
        message: "Brak aktywnych odbiorców TO — wysyłka zablokowana.",
        count: 1,
      },
    ]);
    if (!issuesSaved) return { ok: false, error: "Nie udało się zapisać issue no_recipients" };
    const blockedUpdate = await ensureLogUpdated(logId, {
      status: "blocked",
      events,
      error_message: "Brak odbiorców TO",
      finished_at: new Date().toISOString(),
    });
    if (!blockedUpdate.ok) return blockedUpdate;
    return { ok: true, logId, status: "blocked" };
  }

  const built = await buildIvoclarWeeklyArtifacts(today);
  if (!built.ok) {
    events.push({
      at: new Date().toISOString(),
      kind: "failed",
      message: built.error,
    });
    const issueCode =
      built.code === "subiekt_offline"
        ? "subiekt_offline"
        : built.code === "fs_header_overflow"
          ? "fs_header_overflow"
          : "fetch_error";
    const issuesSaved = await createMailSendIssues(logId, [
      {
        severity: "blocking",
        code: issueCode,
        message: built.error,
        count: 1,
      },
    ]);
    if (!issuesSaved) return { ok: false, error: `Nie udało się zapisać issue ${issueCode}` };
    const failedUpdate = await ensureLogUpdated(logId, {
      status: "failed",
      events,
      error_message: built.error,
      finished_at: new Date().toISOString(),
    });
    if (!failedUpdate.ok) return failedUpdate;
    return { ok: true, logId, status: "failed", issuesCount: 1, blockingIssueCount: 1 };
  }

  const { artifacts } = built;
  events.push({
    at: new Date().toISOString(),
    kind: "generated",
    message: `Sellout ${artifacts.selloutFile.exportedCount}, Inventory ${artifacts.inventoryFile.exportedCount}`,
  });

  if (artifacts.selloutFile.exportedCount === 0) {
    const issuesSaved = await createMailSendIssues(logId, [
      {
        severity: "blocking",
        code: "empty_sellout_export",
        message: "Sellout — brak wierszy gotowych do eksportu XLSX.",
        count: 1,
      },
    ]);
    if (!issuesSaved) return { ok: false, error: "Nie udało się zapisać issue empty_sellout_export" };
    events.push({
      at: new Date().toISOString(),
      kind: "failed",
      message: "empty_sellout_export",
    });
    const failedUpdate = await ensureLogUpdated(logId, {
      status: "failed",
      events,
      summary: {
        selloutExported: 0,
        inventoryExported: artifacts.inventoryFile.exportedCount,
      },
      error_message: "Pusty eksport Sellout",
      finished_at: new Date().toISOString(),
    });
    if (!failedUpdate.ok) return failedUpdate;
    return { ok: true, logId, status: "failed", issuesCount: 1, blockingIssueCount: 1 };
  }

  if (artifacts.inventoryFile.exportedCount === 0) {
    const issuesSaved = await createMailSendIssues(logId, [
      {
        severity: "blocking",
        code: "empty_inventory_export",
        message: "Inventory — brak SKU ze stanem > 0 do eksportu.",
        count: 1,
      },
    ]);
    if (!issuesSaved) return { ok: false, error: "Nie udało się zapisać issue empty_inventory_export" };
    events.push({
      at: new Date().toISOString(),
      kind: "failed",
      message: "empty_inventory_export",
    });
    const failedUpdate = await ensureLogUpdated(logId, {
      status: "failed",
      events,
      summary: {
        selloutExported: artifacts.selloutFile.exportedCount,
        inventoryExported: 0,
      },
      error_message: "Pusty eksport Inventory",
      finished_at: new Date().toISOString(),
    });
    if (!failedUpdate.ok) return failedUpdate;
    return { ok: true, logId, status: "failed", issuesCount: 1, blockingIssueCount: 1 };
  }

  const artifactsIssuesSaved = await createMailSendIssues(
    logId,
    artifacts.issues.map((i) => ({
      severity: i.severity,
      code: i.code,
      message: i.message,
      context: i.context,
      count: i.count,
    }))
  );
  if (!artifactsIssuesSaved) return { ok: false, error: "Nie udało się zapisać issues raportu" };

  const hadWarnings = artifacts.issues.length > 0;
  const issuesCount = artifacts.issues.length;
  const blockingIssueCount = artifacts.issues.filter((i) => i.severity === "blocking").length;
  const subject = ivoclarWeeklyEmailSubject(period);
  const html = renderIvoclarWeeklyEmailHtml({
    period,
    selloutExported: artifacts.selloutFile.exportedCount,
    inventoryExported: artifacts.inventoryFile.exportedCount,
    issues: artifacts.issues,
  });

  const send = await sendHtmlEmailWithAttachments({
    to: recipients.to,
    cc: recipients.cc,
    bcc: recipients.bcc,
    subject,
    html,
    attachments: [
      {
        filename: artifacts.selloutFile.filename,
        content: ivoclarXlsxToBase64(artifacts.selloutFile.bytes),
      },
      {
        filename: artifacts.inventoryFile.filename,
        content: ivoclarXlsxToBase64(artifacts.inventoryFile.bytes),
      },
    ],
  });

  if (!send.ok) {
    events.push({
      at: new Date().toISOString(),
      kind: "failed",
      message: send.error,
    });
    const resendIssueSaved = await createMailSendIssues(logId, [
      {
        severity: "blocking",
        code: "resend_error",
        message: send.error,
        count: 1,
      },
    ]);
    if (!resendIssueSaved) return { ok: false, error: "Nie udało się zapisać issue resend_error" };
    const failedUpdate = await ensureLogUpdated(logId, {
      status: "failed",
      subject,
      events,
      error_message: send.error,
      had_warnings: hadWarnings,
      attachment_manifest: ivoclarAttachmentManifest(
        artifacts.selloutFile,
        artifacts.inventoryFile
      ),
      summary: {
        selloutExported: artifacts.selloutFile.exportedCount,
        inventoryExported: artifacts.inventoryFile.exportedCount,
        selloutSkipped: artifacts.selloutFile.skippedCount,
        inventorySkipped: artifacts.inventoryFile.skippedCount,
      },
      finished_at: new Date().toISOString(),
    });
    if (!failedUpdate.ok) return failedUpdate;
    return { ok: true, logId, status: "failed", hadWarnings, issuesCount: issuesCount + 1, blockingIssueCount: blockingIssueCount + 1 };
  }

  events.push({
    at: new Date().toISOString(),
    kind: "sent",
    message: `Resend id: ${send.id}`,
  });

  const sentUpdate = await ensureLogUpdated(logId, {
    status: "sent",
    subject,
    resend_message_ids: [send.id],
    recipient_snapshot: recipients.snapshot,
    attachment_manifest: ivoclarAttachmentManifest(
      artifacts.selloutFile,
      artifacts.inventoryFile
    ),
    summary: {
      selloutExported: artifacts.selloutFile.exportedCount,
      inventoryExported: artifacts.inventoryFile.exportedCount,
      selloutSkipped: artifacts.selloutFile.skippedCount,
      inventorySkipped: artifacts.inventoryFile.skippedCount,
    },
    events,
    had_warnings: hadWarnings,
    finished_at: new Date().toISOString(),
  });
  if (!sentUpdate.ok) {
    const existingSent = await getLatestSentLogForPeriod(IVOCLAR_WEEKLY_JOB_ID, basePeriodKey);
    if (options.trigger === "manual" && options.skipIdempotency && existingSent) {
      const conflictEvent = {
        at: new Date().toISOString(),
        kind: "blocked",
        message: "manual_force_conflict_with_existing_sent",
      } satisfies MailSendEvent;
      const conflictIssueSaved = await createMailSendIssues(logId, [
        {
          severity: "blocking",
          code: "manual_force_conflict",
          message:
            "Mail został już wysłany dla tego tygodnia. Powtórna wysyłka force nie może zapisać drugiego statusu sent dla produkcyjnego period_key.",
          context: {
            existingSentLogId: existingSent.id,
            existingPeriodKey: existingSent.period_key,
          },
          count: 1,
        },
      ]);
      if (!conflictIssueSaved) {
        return { ok: false, error: "Nie udało się zapisać issue manual_force_conflict" };
      }
      const blockedUpdate = await ensureLogUpdated(logId, {
        status: "blocked",
        events: [...events, conflictEvent],
        error_message:
          "Wysłano ponownie, ale zablokowano zapis drugiego statusu sent dla tego samego tygodnia.",
        had_warnings: true,
        finished_at: new Date().toISOString(),
      });
      if (!blockedUpdate.ok) return blockedUpdate;
      return {
        ok: true,
        logId,
        status: "blocked",
        hadWarnings: true,
        issuesCount: issuesCount + 1,
        blockingIssueCount: blockingIssueCount + 1,
      };
    }
    return { ok: false, error: sentUpdate.error };
  }

  return { ok: true, logId, status: "sent", hadWarnings, issuesCount, blockingIssueCount };
}

export async function previewIvoclarWeeklyMail(todayDateKey?: string) {
  const today = todayDateKey ?? todayDateKeyInWarsaw();
  const built = await buildIvoclarWeeklyArtifacts(today);
  if (!built.ok) {
    return { ok: false as const, error: built.error };
  }
  const { artifacts } = built;
  return {
    ok: true as const,
    period: artifacts.period,
    subject: ivoclarWeeklyEmailSubject(artifacts.period),
    html: renderIvoclarWeeklyEmailHtml({
      period: artifacts.period,
      selloutExported: artifacts.selloutFile.exportedCount,
      inventoryExported: artifacts.inventoryFile.exportedCount,
      issues: artifacts.issues,
    }),
    selloutFilename: artifacts.selloutFile.filename,
    inventoryFilename: artifacts.inventoryFile.filename,
    selloutBase64: ivoclarXlsxToBase64(artifacts.selloutFile.bytes),
    inventoryBase64: ivoclarXlsxToBase64(artifacts.inventoryFile.bytes),
    issues: artifacts.issues,
    canSend:
      artifacts.selloutFile.exportedCount > 0 && artifacts.inventoryFile.exportedCount > 0,
  };
}
