import { createAdminClient } from "@/lib/supabase/admin";
import type { TransactionalEmailKind, TransactionalEmailLog } from "@/types/database";

export type TransactionalEmailLogInsert = {
  kind: TransactionalEmailKind;
  status: "sent" | "failed";
  toAddresses: string[];
  ccAddresses?: string[];
  bccAddresses?: string[];
  intendedTo: string[];
  overrideTo?: string | null;
  fromAddress: string;
  subject: string;
  htmlBody: string;
  messageId?: string | null;
  errorMessage?: string | null;
  hasAttachments?: boolean;
  attachmentNames?: string[];
};

/** Redakcja kodów OTP w temacie/HTML przed zapisem do logu admina. */
export function redactTransactionalEmailForLog(
  kind: TransactionalEmailKind,
  subject: string,
  html: string
): { subject: string; html: string } {
  if (kind !== "password_reset_otp") {
    return { subject, html };
  }
  const redact = (s: string) => s.replace(/\b\d{6}\b/g, "••••••");
  return { subject: redact(subject), html: redact(html) };
}

/**
 * Zapis logu — nigdy nie rzuca (wysyłka nie może paść przez audit).
 * Wymaga migracji 146. Pełny HTML bez automatycznej retencji —
 * ops: okresowo `DELETE FROM transactional_email_log WHERE created_at < now() - interval '90 days'`.
 */
export async function recordTransactionalEmailLog(
  input: TransactionalEmailLogInsert
): Promise<void> {
  try {
    const { subject, html } = redactTransactionalEmailForLog(
      input.kind,
      input.subject,
      input.htmlBody
    );
    const supabase = createAdminClient();
    const { error } = await supabase.from("transactional_email_log").insert({
      kind: input.kind,
      status: input.status,
      to_addresses: input.toAddresses,
      cc_addresses: input.ccAddresses ?? [],
      bcc_addresses: input.bccAddresses ?? [],
      intended_to: input.intendedTo,
      override_to: input.overrideTo ?? null,
      from_address: input.fromAddress,
      subject,
      html_body: html,
      message_id: input.messageId ?? null,
      error_message: input.errorMessage ?? null,
      has_attachments: input.hasAttachments ?? false,
      attachment_names: input.attachmentNames ?? [],
    });
    if (error) {
      console.error("[transactional-email-log] insert failed:", error.message);
    }
  } catch (err) {
    console.error(
      "[transactional-email-log] unexpected:",
      err instanceof Error ? err.message : err
    );
  }
}

export type ListTransactionalEmailLogsParams = {
  limit?: number;
  offset?: number;
  kind?: TransactionalEmailKind | "all";
  status?: "sent" | "failed" | "all";
};

export async function listTransactionalEmailLogs(
  params: ListTransactionalEmailLogsParams = {}
): Promise<{ rows: TransactionalEmailLog[]; total: number }> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const offset = Math.max(params.offset ?? 0, 0);
  const supabase = createAdminClient();

  let query = supabase
    .from("transactional_email_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.kind && params.kind !== "all") {
    query = query.eq("kind", params.kind);
  }
  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    rows: (data ?? []) as TransactionalEmailLog[],
    total: count ?? 0,
  };
}

export async function getTransactionalEmailLogById(
  id: string
): Promise<TransactionalEmailLog | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("transactional_email_log")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TransactionalEmailLog | null) ?? null;
}

export { TRANSACTIONAL_EMAIL_KIND_LABELS } from "@/lib/services/transactional-email-labels";
