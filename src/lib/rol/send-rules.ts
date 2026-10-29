/**
 * Wysyłka zgłoszenia ROL (plasterek 5) — czyste reguły: pozycje i opis ZD, porównanie ZD po zapisie,
 * domyślny mail według wzoru i walidacja tego, co użytkownik zmienił w oknie.
 */
import type { RolInvoiceView, RolLineView } from "./data";
import { rolActiveLines, rolLineQty, rolMonthEn, rolMonthPl } from "./view";

type BatchContent = { invoices: readonly RolInvoiceView[]; lines: readonly RolLineView[] };

/** Pozycje ZD do Ivoclara: towar (tw_Id) i suma ilości ze wszystkich FS paczki. */
export function rolZdLines(batch: BatchContent): Array<{ towarId: number; ilosc: number }> {
  const byTw = new Map<number, number>();
  for (const l of rolActiveLines(batch)) byTw.set(l.twId, (byTw.get(l.twId) ?? 0) + rolLineQty(l));
  return [...byTw].map(([towarId, ilosc]) => ({ towarId, ilosc }));
}

/** Opis ZD (decyzja P6): „ROL <klient> <miesiąc>” bez roku. */
export function rolZdUwagi(label: string, period: string): string {
  return `ROL ${label} ${rolMonthPl(period)}`;
}

/**
 * Weryfikacja ZD: dokładnie te towary i ilości co lista. ZD utworzona wcześniej, a lista potem zmieniona
 * („Edytuj listę”, ponowny skan), nie może przejść z nadmiarem — mail i ZD muszą się zgadzać.
 * Zwraca opis rozbieżności albo null.
 */
export function rolZdMismatch(sent: ReadonlyArray<{ towarId: number; ilosc: number }>, saved: ReadonlyMap<number, number>): string | null {
  const wanted = new Map(sent.map((l) => [l.towarId, l.ilosc]));
  const differ = sent.filter((l) => Math.abs((saved.get(l.towarId) ?? 0) - l.ilosc) > 1e-9).length;
  const extra = [...saved.keys()].filter((tw) => !wanted.has(tw) && (saved.get(tw) ?? 0) > 0).length;
  if (!differ && !extra) return null;
  const parts = [differ ? `inna ilość albo brak: ${differ}` : "", extra ? `poza listą: ${extra}` : ""].filter(Boolean);
  return `pozycje ZD różnią się od listy (${parts.join(", ")})`;
}

export type RolMailDraft = { to: string[]; cc: string[]; subject: string; body: string };

/** Mail według wzoru z Gmaila: jeden klient, blok „ROL <klient> <Month> -25%”, adres, NIP, podpis. */
export function rolMailDraft(input: {
  program: { label: string; discountPct: number; addressLines: readonly string[]; nip: string; toEmails: readonly string[]; ccEmails: readonly string[] };
  period: string;
  defaults: { toEmails: readonly string[]; ccEmails: readonly string[]; subject: string };
  signature: string;
}): RolMailDraft {
  const p = input.program;
  const block = [`ROL ${p.label} ${rolMonthEn(input.period)} -${p.discountPct}%`, ...p.addressLines, p.nip ? `NIP: ${p.nip}` : ""]
    .filter(Boolean)
    .join("\n");
  const body = ["Dear Sirs,", "", "Please find attached our new order.", "", block, "", "Thank you,", input.signature.trim()]
    .join("\n")
    .trimEnd();
  return {
    to: [...(p.toEmails.length ? p.toEmails : input.defaults.toEmails)],
    cc: [...(p.toEmails.length ? p.ccEmails : input.defaults.ccEmails)],
    subject: input.defaults.subject || "New Order",
    body,
  };
}

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** Granica zaufania: to, co przyszło z okna maila. */
export function parseRolMailInput(input: { to: string; cc: string; subject: string; body: string }):
  | { ok: true; value: RolMailDraft }
  | { ok: false; error: string } {
  const list = (s: string) => [...new Set(s.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))];
  const to = list(input.to);
  const cc = list(input.cc);
  if (!to.length) return { ok: false, error: "Podaj co najmniej jednego adresata w polu „Do”." };
  const bad = [...to, ...cc].find((e) => !EMAIL_RE.test(e));
  if (bad) return { ok: false, error: `„${bad}” nie wygląda na adres e-mail.` };
  if (to.length + cc.length > 20) return { ok: false, error: "Za dużo adresatów (najwyżej 20)." };
  const subject = input.subject.trim();
  if (!subject || subject.length > 200) return { ok: false, error: "Temat nie może być pusty (do 200 znaków)." };
  const body = input.body.replace(/\r\n/g, "\n").trim();
  if (!body || body.length > 20_000) return { ok: false, error: "Treść nie może być pusta (do 20 000 znaków)." };
  return { ok: true, value: { to, cc, subject, body } };
}
