/**
 * Wysyłka zgłoszenia ROL (plasterek 5) w dwóch krokach, każdy pod blokadą paczki:
 * 1. ZD do Ivoclara w Subiekcie — najpierw szukamy dzisiejszej ZD z tym samym opisem (ponowienie po
 *    przerwanym zapisie nie tworzy drugiej), numer zapisujemy od razu, potem weryfikacja pozycji.
 * 2. Mail z Gmaila osoby z plikami tej paczki; dopiero po udanej wysyłce paczka jest „wyslane”.
 * Baza, Subiekt i Gmail są wstrzykiwane — testy przechodzą każdą ścieżkę błędu bez sieci.
 */
import type { RolBatchView } from "./data";
import type { RolBatchFiles } from "./files";
import { rolZdLines, rolZdMismatch, rolZdUwagi, type RolMailDraft } from "./send-rules";

export type RolSendStore = {
  /** Blokada wysyłki: tylko paczka „przejrzane”, nieblokowana (albo blokada przeterminowana). */
  lock: (batchId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  unlock: (batchId: string) => Promise<void>;
  saveZd: (batchId: string, zd: { dokId: number; nr: string }) => Promise<void>;
  markSent: (
    batchId: string,
    record: {
      sentBy: string;
      from: string;
      messageId: string;
      threadId: string | null;
      mail: RolMailDraft;
      attachments: Array<{ name: string; bytes: number; sha256: string }>;
    }
  ) => Promise<void>;
};

export type RolZdApi = {
  /** Dzisiejsza ZD do Ivoclara z tym opisem (po przerwanym zapisie). */
  findExisting: (input: { khId: number; uwagi: string; dateKey: string }) => Promise<{ dokId: number; nr: string } | null>;
  create: (body: {
    kontrahentId: number;
    personelId?: number;
    uwagi: string;
    pozycje: Array<{ towarId: number; ilosc: number }>;
  }) => Promise<{ dokId: number; nr: string }>;
  readLines: (dokId: number) => Promise<Map<number, number>>;
};

export type RolMailSender = (input: {
  userId: string;
  to: string[];
  cc: string[];
  subject: string;
  text: string;
  attachments: Array<{ filename: string; content: Buffer; contentType: string }>;
}) => Promise<
  | { ok: true; from: string; messageId: string; threadId: string | null }
  | { ok: false; message: string; reconnect?: boolean; uncertain?: boolean }
>;

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function underLock<T>(store: RolSendStore, batchId: string, fn: () => Promise<Result<T>>): Promise<Result<T>> {
  const lock = await store.lock(batchId);
  if (!lock.ok) return lock;
  try {
    return await fn();
  } finally {
    await store.unlock(batchId);
  }
}

/** Krok 1: ZD w Subiekcie (albo istniejąca) + weryfikacja pozycji po zapisie. */
export async function ensureRolZd(
  ctx: {
    batch: Pick<RolBatchView, "id" | "period" | "invoices" | "lines" | "zdDokId" | "zdNr">;
    programLabel: string;
    missingPdf: readonly string[];
    ivoclarKhId: number;
    personelId: number | null;
    todayKey: string;
  },
  store: RolSendStore,
  zd: RolZdApi
): Promise<Result<{ zdNr: string; created: boolean }>> {
  return underLock<{ zdNr: string; created: boolean }>(store, ctx.batch.id, async () => {
    if (ctx.missingPdf.length) return { ok: false, error: `Czekam na PDF: ${ctx.missingPdf.join(", ")}. ZD utworzę, gdy pliki będą gotowe.` };
    const pozycje = rolZdLines(ctx.batch);
    if (!pozycje.length) return { ok: false, error: "Na liście nie ma pozycji do zamówienia." };

    let doc = ctx.batch.zdDokId ? { dokId: ctx.batch.zdDokId, nr: ctx.batch.zdNr ?? `ZD/${ctx.batch.zdDokId}` } : null;
    let created = false;
    if (!doc) {
      const uwagi = rolZdUwagi(ctx.programLabel, ctx.batch.period);
      doc = await zd.findExisting({ khId: ctx.ivoclarKhId, uwagi, dateKey: ctx.todayKey });
      if (!doc) {
        doc = await zd.create({
          kontrahentId: ctx.ivoclarKhId,
          ...(ctx.personelId != null ? { personelId: ctx.personelId } : {}),
          uwagi,
          pozycje,
        });
        created = true;
      }
      // Numer zapisany przed weryfikacją — ponowienie nigdy nie tworzy drugiej ZD.
      await store.saveZd(ctx.batch.id, doc);
    }
    const mismatch = rolZdMismatch(pozycje, await zd.readLines(doc.dokId));
    if (mismatch) return { ok: false, error: `ZD ${doc.nr} jest w Subiekcie, ale ${mismatch}. Sprawdź ją przed wysyłką maila.` };
    return { ok: true, zdNr: doc.nr, created };
  });
}

/** Krok 2: mail z plikami tej paczki; „wyslane” dopiero po potwierdzeniu z Gmaila. */
export async function sendRolMail(
  ctx: {
    batch: Pick<RolBatchView, "id" | "zdDokId">;
    files: RolBatchFiles;
    mail: RolMailDraft;
    userId: string;
    sha256: (b: Buffer) => string;
  },
  store: RolSendStore,
  send: RolMailSender
): Promise<Result<{ from: string }>> {
  return underLock<{ from: string }>(store, ctx.batch.id, async () => {
    if (!ctx.batch.zdDokId) return { ok: false, error: "Najpierw utwórz ZD w Subiekcie." };
    if (ctx.files.missingPdf.length) return { ok: false, error: `Czekam na PDF: ${ctx.files.missingPdf.join(", ")}.` };
    const files = [ctx.files.sheet, ...ctx.files.pdfs];
    const res = await send({
      userId: ctx.userId,
      to: ctx.mail.to,
      cc: ctx.mail.cc,
      subject: ctx.mail.subject,
      text: ctx.mail.body,
      attachments: files.map((f) => ({ filename: f.name, content: f.content, contentType: f.contentType })),
    });
    if (!res.ok) return { ok: false, error: res.message };
    try {
      await store.markSent(ctx.batch.id, {
        sentBy: ctx.userId,
        from: res.from,
        messageId: res.messageId,
        threadId: res.threadId,
        mail: ctx.mail,
        attachments: files.map((f) => ({ name: f.name, bytes: f.content.length, sha256: ctx.sha256(f.content) })),
      });
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      return { ok: false, error: `Mail wyszedł z ${res.from}, ale nie zapisał się w historii (${why}). Nie wysyłaj go ponownie — sprawdź „Wysłane” w Gmailu.` };
    }
    return { ok: true, from: res.from };
  });
}
