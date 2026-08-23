import { createAdminClient } from "@/lib/supabase/admin";
import type {
  MailJobDefinition,
  MailJobRecipient,
  MailSendEvent,
  MailSendIssue,
  MailSendLog,
  MailSendStatus,
  MailSendTriggerKind,
} from "@/types/database";

export type MailRecipientSnapshot = {
  email: string;
  display_name: string | null;
  recipient_role: MailJobRecipient["recipient_role"];
};

export type MailAttachmentManifestEntry = {
  name: string;
  bytes: number;
  sha256: string;
};

export async function loadMailJob(jobId: string): Promise<MailJobDefinition | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("mail_job_definitions")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  return (data as MailJobDefinition | null) ?? null;
}

export async function loadAllMailJobs(): Promise<MailJobDefinition[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("mail_job_definitions")
    .select("*")
    .order("id");
  return (data ?? []) as MailJobDefinition[];
}

export async function loadMailJobRecipients(jobId: string): Promise<MailJobRecipient[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("mail_job_recipients")
    .select("*")
    .eq("job_id", jobId)
    .order("sort_order")
    .order("email");
  return (data ?? []) as MailJobRecipient[];
}

export async function hasSentMailForPeriod(
  jobId: string,
  periodKey: string
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("mail_send_log")
    .select("id")
    .eq("job_id", jobId)
    .eq("period_key", periodKey)
    .eq("status", "sent")
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

export async function nextMailAttemptNo(jobId: string, periodKey: string): Promise<number> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("mail_send_log")
    .select("attempt_no")
    .eq("job_id", jobId)
    .eq("period_key", periodKey)
    .order("attempt_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  const prev = data?.attempt_no;
  return typeof prev === "number" ? prev + 1 : 1;
}

export async function nextMailAttemptNoForPeriodFamily(
  jobId: string,
  basePeriodKey: string
): Promise<number> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("mail_send_log")
    .select("attempt_no")
    .eq("job_id", jobId)
    .or(`period_key.eq.${basePeriodKey},period_key.like.${basePeriodKey}:%`)
    .order("attempt_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  const prev = data?.attempt_no;
  return typeof prev === "number" ? prev + 1 : 1;
}

export async function createMailSendLog(input: {
  job_id: string;
  period_key: string;
  attempt_no: number;
  trigger_kind: MailSendTriggerKind;
  triggered_by?: string | null;
  status: MailSendStatus;
  period_from?: string | null;
  period_to?: string | null;
  subject?: string | null;
  recipient_snapshot?: MailRecipientSnapshot[];
  events?: MailSendEvent[];
}): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("mail_send_log")
    .insert({
      job_id: input.job_id,
      period_key: input.period_key,
      attempt_no: input.attempt_no,
      trigger_kind: input.trigger_kind,
      triggered_by: input.triggered_by ?? null,
      status: input.status,
      period_from: input.period_from ?? null,
      period_to: input.period_to ?? null,
      subject: input.subject ?? null,
      recipient_snapshot: input.recipient_snapshot ?? [],
      events: input.events ?? [],
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    console.error("createMailSendLog", error.message);
    return null;
  }
  return data.id as string;
}

export async function updateMailSendLog(
  logId: string,
  patch: Partial<{
    status: MailSendStatus;
    subject: string | null;
    resend_message_ids: string[];
    recipient_snapshot: MailRecipientSnapshot[];
    attachment_manifest: MailAttachmentManifestEntry[];
    summary: Record<string, unknown>;
    events: MailSendEvent[];
    error_message: string | null;
    had_warnings: boolean;
    finished_at: string | null;
  }>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("mail_send_log").update(patch).eq("id", logId);
  if (error) {
    console.error("updateMailSendLog", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function appendMailSendEvent(
  logId: string,
  events: MailSendEvent[],
  event: MailSendEvent
): Promise<MailSendEvent[]> {
  const next = [...events, event];
  await updateMailSendLog(logId, { events: next });
  return next;
}

export async function createMailSendIssues(
  sendLogId: string,
  issues: Array<{
    severity: MailSendIssue["severity"];
    code: string;
    message: string;
    context?: Record<string, unknown>;
    count?: number;
  }>
): Promise<boolean> {
  if (!issues.length) return true;
  const supabase = createAdminClient();
  const rows = issues.map((i) => ({
    send_log_id: sendLogId,
    severity: i.severity,
    code: i.code,
    message: i.message,
    context: i.context ?? {},
    count: i.count ?? 1,
  }));
  const { error } = await supabase.from("mail_send_issues").insert(rows);
  if (error) {
    console.error("createMailSendIssues", error.message);
    return false;
  }
  return true;
}

export async function listMailSendLogs(options: {
  jobId?: string;
  limit?: number;
  status?: MailSendStatus;
}): Promise<MailSendLog[]> {
  const supabase = createAdminClient();
  let q = supabase
    .from("mail_send_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);
  if (options.jobId) q = q.eq("job_id", options.jobId);
  if (options.status) q = q.eq("status", options.status);
  const { data } = await q;
  return (data ?? []) as MailSendLog[];
}

export async function getMailSendLogDetail(logId: string): Promise<{
  log: MailSendLog;
  issues: MailSendIssue[];
} | null> {
  const supabase = createAdminClient();
  const { data: log } = await supabase
    .from("mail_send_log")
    .select("*")
    .eq("id", logId)
    .maybeSingle();
  if (!log) return null;
  const { data: issues } = await supabase
    .from("mail_send_issues")
    .select("*")
    .eq("send_log_id", logId)
    .order("severity")
    .order("code");
  return {
    log: log as MailSendLog,
    issues: (issues ?? []) as MailSendIssue[],
  };
}

export async function getLatestSentLogForPeriod(
  jobId: string,
  periodKey: string
): Promise<MailSendLog | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("mail_send_log")
    .select("*")
    .eq("job_id", jobId)
    .eq("period_key", periodKey)
    .eq("status", "sent")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as MailSendLog | null) ?? null;
}

export async function getLatestLogForPeriod(
  jobId: string,
  periodKey: string
): Promise<MailSendLog | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("mail_send_log")
    .select("*")
    .eq("job_id", jobId)
    .eq("period_key", periodKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as MailSendLog | null) ?? null;
}

export async function getLatestMailLogForJob(jobId: string): Promise<MailSendLog | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("mail_send_log")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as MailSendLog | null) ?? null;
}
