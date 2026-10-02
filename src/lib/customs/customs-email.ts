/** Mail do agencji celnej — temat, HTML z treści tekstowej, walidacja adresów. Czysta logika. */

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/;

/** „a@x.pl; b@y.pl, c@z.pl” → lista; błędne adresy osobno. */
export function parseEmailList(raw: string): { emails: string[]; invalid: string[] } {
  const emails: string[] = [];
  const invalid: string[] = [];
  for (const part of raw.split(/[,;\s]+/)) {
    const v = part.trim().toLowerCase();
    if (!v) continue;
    if (!EMAIL_RE.test(v)) invalid.push(part.trim());
    else if (!emails.includes(v)) emails.push(v);
  }
  return { emails, invalid };
}

export function customsEmailSubject(input: {
  supplierName: string;
  invoiceNumber: string;
  zdNumber: string | null;
}): string {
  const parts = [`Odprawa celna — ${input.supplierName}`];
  if (input.invoiceNumber) parts.push(`faktura ${input.invoiceNumber}`);
  if (input.zdNumber) parts.push(input.zdNumber);
  return parts.join(" — ");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Treść tekstowa maila jako prosty HTML (zachowane wiersze i odstępy akapitów). */
export function customsEmailHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111">\n${paragraphs}\n</div>`;
}

/** Limit łącznego rozmiaru załączników (serwery pocztowe zwykle ~25 MB po base64). */
export const CUSTOMS_EMAIL_MAX_ATTACHMENTS_BYTES = 18 * 1024 * 1024;
