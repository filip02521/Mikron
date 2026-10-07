import { parseEmailList } from "@/lib/customs/customs-email";

/** Najwięcej adresów (Do + DW) w jednej wysyłce na zewnątrz. */
export const MAIL_RECIPIENTS_MAX = 10;

/**
 * Do + DW z pól formularza: poprawne adresy, bez powtórek (adres z Do nie trafia do DW), z limitem.
 * Błąd ma gotowy komunikat dla użytkownika.
 */
export function parseMailRecipients(
  toRaw: string,
  ccRaw: string | undefined
): { ok: true; to: string[]; cc: string[] } | { ok: false; message: string } {
  const to = parseEmailList(toRaw);
  if (to.invalid.length) return { ok: false, message: `Błędny adres w polu Do: ${to.invalid.join(", ")}` };
  if (!to.emails.length) return { ok: false, message: "Podaj adres odbiorcy." };
  const cc = parseEmailList(ccRaw ?? "");
  if (cc.invalid.length) return { ok: false, message: `Błędny adres w polu DW: ${cc.invalid.join(", ")}` };
  const ccOnly = cc.emails.filter((e) => !to.emails.includes(e));
  if (to.emails.length + ccOnly.length > MAIL_RECIPIENTS_MAX) {
    return { ok: false, message: `Najwyżej ${MAIL_RECIPIENTS_MAX} adresów w jednej wiadomości (Do i DW razem).` };
  }
  return { ok: true, to: to.emails, cc: ccOnly };
}
