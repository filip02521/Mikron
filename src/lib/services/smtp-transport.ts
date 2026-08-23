import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import {
  getSmtpHost,
  getSmtpPass,
  getSmtpPort,
  getSmtpSecure,
  getSmtpUser,
  isEmailConfigured,
} from "@/lib/env/email-config";

const CONNECTION_TIMEOUT_MS = 25_000;
const SOCKET_TIMEOUT_MS = 25_000;

export type SmtpAttachment = {
  filename: string;
  /** Base64-encoded content (kontrakt `EmailAttachmentInput.content`). */
  content: Buffer;
  contentType?: string;
};

export type SmtpSendParams = {
  from: string;
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  attachments?: SmtpAttachment[];
};

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!isEmailConfigured()) return null;
  if (transporter) return transporter;

  const host = getSmtpHost();
  const user = getSmtpUser();
  const pass = getSmtpPass();
  if (!host || !user || !pass) return null;

  transporter = nodemailer.createTransport({
    host,
    port: getSmtpPort(),
    secure: getSmtpSecure(),
    auth: { user, pass },
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
  });
  return transporter;
}

/** Reset lazy singleton — tylko testy. */
export function resetSmtpTransporterForTests(): void {
  transporter = null;
}

export async function sendMailRaw(
  params: SmtpSendParams
): Promise<{ messageId: string }> {
  const transport = getTransporter();
  if (!transport) {
    throw new Error(
      "Brak konfiguracji SMTP / EMAIL_FROM — ustaw SMTP_HOST, SMTP_USER, SMTP_PASS oraz EMAIL_FROM lub EMAIL_DOMAIN"
    );
  }

  const info = await transport.sendMail({
    from: params.from,
    to: params.to,
    cc: params.cc?.length ? params.cc : undefined,
    bcc: params.bcc?.length ? params.bcc : undefined,
    subject: params.subject,
    html: params.html,
    attachments: params.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });

  return { messageId: String(info.messageId ?? "") };
}
