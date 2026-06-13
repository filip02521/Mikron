import { escapeHtml } from "@/lib/security/escape-html";
import {
  EMAIL_THEME,
  emailDocument,
  emailGreeting,
  emailMutedParagraph,
  emailParagraph,
} from "@/lib/email/sales-email-layout";

export function renderPasswordResetOtpEmail(params: {
  recipientName: string;
  code: string;
  validMinutes: number;
}): { subject: string; html: string } {
  const code = escapeHtml(params.code);
  const name = escapeHtml(params.recipientName.trim() || "Użytkowniku");
  const minutes = params.validMinutes;

  const bodyHtml = [
    emailGreeting(name),
    emailParagraph(
      "Otrzymaliśmy prośbę o reset hasła do konta w systemie dostaw. Wpisz poniższy kod na ekranie logowania:"
    ),
    `<div style="margin:24px 0;text-align:center;">
      <div style="display:inline-block;padding:16px 28px;border-radius:12px;border:1px solid ${EMAIL_THEME.infoBorder};background:${EMAIL_THEME.infoBg};">
        <div style="font-size:32px;font-weight:700;letter-spacing:0.35em;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:${EMAIL_THEME.foreground};">${code}</div>
      </div>
    </div>`,
    emailParagraph(`Kod jest ważny przez <strong>${minutes} minut</strong>.`),
    emailMutedParagraph(
      "Jeśli to nie Ty prosiłeś o reset hasła, zignoruj tę wiadomość. Hasło pozostanie bez zmian."
    ),
  ].join("");

  return {
    subject: `Kod resetu hasła: ${params.code}`,
    html: emailDocument({
      preheader: `Twój kod resetu hasła: ${params.code}`,
      headerTitle: "Reset hasła",
      headerSubtitle: "Kod weryfikacyjny",
      bodyHtml,
    }),
  };
}
