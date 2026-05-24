import { escapeHtml } from "@/lib/security/escape-html";
import {
  ONTIME_APP_NAME,
  ONTIME_COMPANY,
  ONTIME_LOGO_MONOGRAM,
  ONTIME_TAGLINE_SHORT,
} from "@/lib/ui/ontime-brand";

/** Tokeny kolorystyczne zgodne z globals.css / ontime-theme. */
export const EMAIL_THEME = {
  background: "#f4f6f9",
  card: "#ffffff",
  border: "#e2e8f0",
  foreground: "#0f172a",
  muted: "#64748b",
  mutedFg: "#475569",
  primary: "#4f46e5",
  primaryHover: "#4338ca",
  primaryMuted: "#eef2ff",
  success: "#059669",
  successBg: "#ecfdf5",
  successBorder: "#a7f3d0",
  warning: "#d97706",
  warningBg: "#fffbeb",
  warningBorder: "#fde68a",
  info: "#4f46e5",
  infoBg: "#eef2ff",
  infoBorder: "#c7d2fe",
} as const;

export function emailDocument(params: {
  preheader: string;
  headerTitle: string;
  headerSubtitle: string;
  accentColor?: string;
  bodyHtml: string;
  footerNote?: string;
}): string {
  const accent = params.accentColor ?? EMAIL_THEME.primary;
  const preheader = escapeHtml(params.preheader);
  const title = escapeHtml(params.headerTitle);
  const subtitle = escapeHtml(params.headerSubtitle);
  const footer = escapeHtml(
    params.footerNote ??
      `${ONTIME_COMPANY} · ${ONTIME_APP_NAME} — ${ONTIME_TAGLINE_SHORT}`
  );

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${EMAIL_THEME.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.55;color:${EMAIL_THEME.foreground};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${EMAIL_THEME.background};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td bgcolor="${accent}" style="background-color:${accent};background:linear-gradient(135deg, ${accent} 0%, ${EMAIL_THEME.primaryHover} 100%);border-radius:12px 12px 0 0;padding:24px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="48" valign="middle">
                    <div style="width:44px;height:44px;border-radius:999px;background:rgba(255,255,255,0.18);text-align:center;line-height:44px;font-size:14px;font-weight:700;color:#ffffff;letter-spacing:0.04em;">${escapeHtml(ONTIME_LOGO_MONOGRAM)}</div>
                  </td>
                  <td valign="middle" style="padding-left:14px;">
                    <div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">${escapeHtml(ONTIME_APP_NAME)}</div>
                    <div style="font-size:13px;color:rgba(255,255,255,0.88);margin-top:4px;">${title}</div>
                    <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:2px;">${subtitle}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:${EMAIL_THEME.card};border:1px solid ${EMAIL_THEME.border};border-top:none;border-radius:0 0 12px 12px;padding:28px;box-shadow:0 4px 14px -4px rgba(15,23,42,0.08);">
              ${params.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 8px 0;text-align:center;font-size:12px;line-height:1.5;color:${EMAIL_THEME.muted};">
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailParagraph(html: string): string {
  return `<p style="margin:0 0 16px;color:${EMAIL_THEME.foreground};">${html}</p>`;
}

export function emailMutedParagraph(html: string): string {
  return `<p style="margin:0 0 20px;font-size:14px;color:${EMAIL_THEME.mutedFg};">${html}</p>`;
}

export function emailButton(href: string, label: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
    <tr>
      <td bgcolor="${EMAIL_THEME.primary}" style="border-radius:10px;background-color:${EMAIL_THEME.primary};">
        <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${safeLabel}</a>
      </td>
    </tr>
  </table>`;
}

export function emailDataRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;font-size:12px;font-weight:600;color:${EMAIL_THEME.muted};width:108px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;font-size:14px;color:${EMAIL_THEME.foreground};vertical-align:top;word-break:break-word;">${escapeHtml(value)}</td>
  </tr>`;
}

export function emailItemCard(
  badge: { label: string; bg: string; color: string; border: string },
  rowsHtml: string,
  opts?: { positionLabel?: string; supplierName?: string }
): string {
  const supplierLine = opts?.supplierName
    ? `<div style="margin-top:8px;font-size:15px;font-weight:600;color:${EMAIL_THEME.foreground};">${escapeHtml(opts.supplierName)}</div>`
    : "";
  const positionLine = opts?.positionLabel
    ? `<span style="font-size:11px;font-weight:600;color:${EMAIL_THEME.muted};letter-spacing:0.03em;text-transform:uppercase;">${escapeHtml(opts.positionLabel)}</span>`
    : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;border:1px solid ${EMAIL_THEME.border};border-radius:10px;overflow:hidden;">
    <tr>
      <td style="padding:12px 16px;background-color:${EMAIL_THEME.background};border-bottom:1px solid ${EMAIL_THEME.border};">
        ${positionLine}
        <span style="display:inline-block;margin-top:${opts?.positionLabel ? "6px" : "0"};padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.02em;background-color:${badge.bg};color:${badge.color};border:1px solid ${badge.border};">${escapeHtml(badge.label)}</span>
        ${supplierLine}
      </td>
    </tr>
    <tr>
      <td style="padding:14px 16px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
      </td>
    </tr>
  </table>`;
}

export function emailGreeting(firstName: string): string {
  const name = firstName.trim() || "Handlowcu";
  return emailParagraph(`Cześć <strong>${escapeHtml(name)}</strong>,`);
}
