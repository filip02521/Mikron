/** Maskuje e-mail do wyświetlenia na ekranie logowania (j***@firma.pl). */
export function maskEmailForDisplay(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf("@");
  if (at <= 0) return normalized;

  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!domain) return normalized;

  const visible = local.length <= 1 ? local : local[0]!;
  return `${visible}***@${domain}`;
}
