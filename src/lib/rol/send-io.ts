// @service-role-ok — wywoływane z akcji wysyłki ROL po requireOperations("mutate") + rola admin/zakupy.
/**
 * Prawdziwe implementacje dla `send.ts`: baza (blokada, ZD w paczce, historia), Subiekt (ZD do Ivoclara)
 * i domyślne ustawienia maila.
 */
import { createHash } from "node:crypto";
import { query, withClient } from "@/lib/db/pool";
import { createSubiektOrdersZd, getSubiektOrdersZd, searchSubiektOrdersZd } from "@/lib/subiekt/api";
import type { RolSendStore, RolZdApi } from "./send";

/** Blokada starsza niż to (zapis ZD do 180 s + weryfikacja, wysyłka) uznajemy za przerwaną. */
const LOCK_MINUTES = 10;
/** Ile dni wstecz szukamy ZD z tym samym opisem przed utworzeniem nowej. */
const FIND_DAYS = 7;

export const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

export const rolSendStore: RolSendStore = {
  async lock(batchId) {
    const res = await query(
      `UPDATE rol_batches SET sending_at = now()
        WHERE id = $1 AND status = 'przejrzane'
          AND (sending_at IS NULL OR sending_at < now() - make_interval(mins => $2))
        RETURNING id`,
      [batchId, LOCK_MINUTES]
    );
    if (res.rowCount) return { ok: true };
    const cur = await query<{ status: string }>(`SELECT status FROM rol_batches WHERE id = $1`, [batchId]);
    const status = cur.rows[0]?.status;
    if (status !== "przejrzane") return { ok: false, error: "Lista nie jest zatwierdzona albo już ją wysłano — odśwież stronę." };
    return { ok: false, error: "Ktoś właśnie wysyła tę paczkę — spróbuj za chwilę." };
  },
  async unlock(batchId) {
    await query(`UPDATE rol_batches SET sending_at = NULL WHERE id = $1`, [batchId]);
  },
  async saveZd(batchId, zd) {
    await query(`UPDATE rol_batches SET zd_dok_id = $2, zd_nr = $3 WHERE id = $1`, [batchId, zd.dokId, zd.nr]);
  },
  async markSent(batchId, r) {
    await withClient(async (db) => {
      await db.query("BEGIN");
      try {
        await db.query(
          `INSERT INTO rol_sends (batch_id, sent_by, from_address, gmail_message_id, gmail_thread_id, to_emails, cc_emails,
                                  subject, body, attachments, kind)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, 'zgloszenie')`,
          [batchId, r.sentBy, r.from, r.messageId, r.threadId, r.mail.to, r.mail.cc, r.mail.subject, r.mail.body, JSON.stringify(r.attachments)]
        );
        await db.query(`UPDATE rol_batches SET status = 'wyslane', sending_at = NULL WHERE id = $1`, [batchId]);
        await db.query("COMMIT");
      } catch (e) {
        await db.query("ROLLBACK");
        throw e;
      }
    });
  },
};

const shiftKey = (key: string, days: number) =>
  new Date(Date.parse(`${key}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export const rolZdApi: RolZdApi = {
  async findExisting({ khId, uwagi, dateKey }) {
    let page = 1;
    let totalPages = 1;
    do {
      const res = await searchSubiektOrdersZd({ dataOd: shiftKey(dateKey, -FIND_DAYS), dataDo: dateKey, page, pageSize: 200 });
      for (const d of res.data ?? []) {
        const forIvoclar = Number(d.dok_OdbiorcaId) === khId || Number(d.dok_PlatnikId) === khId;
        if (forIvoclar && String(d.dok_Uwagi ?? "").trim() === uwagi) {
          return { dokId: Number(d.dok_Id), nr: String(d.dok_NrPelny ?? `ZD/${d.dok_Id}`) };
        }
      }
      totalPages = Math.max(1, Math.trunc(Number(res.pagination?.totalPages) || 1));
      page += 1;
    } while (page <= totalPages);
    return null;
  },
  async create(body) {
    const doc = await createSubiektOrdersZd(body);
    const dokId = Math.trunc(Number(doc.dok_Id));
    return { dokId, nr: String(doc.dok_NrPelny ?? `ZD/${dokId}`) };
  },
  async readLines(dokId) {
    const doc = await getSubiektOrdersZd(dokId);
    const out = new Map<number, number>();
    for (const p of doc.dok_Pozycja ?? []) {
      const tw = Math.trunc(Number(p.ob_TowId) || 0);
      if (tw > 0) out.set(tw, (out.get(tw) ?? 0) + (Number(p.ob_Ilosc) || 0));
    }
    return out;
  },
};

/** Kartoteka Ivoclara w Subiekcie (dostawca w OnTime z „Ivoclar” w nazwie i kh_Id). */
export async function loadIvoclarKhId(): Promise<number> {
  const res = await query<{ kh: number }>(
    `SELECT DISTINCT subiekt_kh_id AS kh FROM suppliers WHERE name ILIKE '%ivoclar%' AND subiekt_kh_id IS NOT NULL`
  );
  if (res.rows.length !== 1) {
    throw new Error(
      res.rows.length
        ? "Kilku dostawców Ivoclar ma różne kartoteki w Subiekcie — zostaw jedną w karcie dostawcy."
        : "Dostawca Ivoclar nie ma kartoteki Subiekta (kh_Id) w karcie dostawcy."
    );
  }
  return Number(res.rows[0]!.kh);
}

export async function loadRolMailDefaults(): Promise<{ toEmails: string[]; ccEmails: string[]; subject: string }> {
  const res = await query<{ to_emails: string[]; cc_emails: string[]; subject_template: string }>(
    `SELECT to_emails, cc_emails, subject_template FROM rol_mail_settings WHERE id = 1`
  );
  const r = res.rows[0];
  return { toEmails: r?.to_emails ?? [], ccEmails: r?.cc_emails ?? [], subject: r?.subject_template || "New Order" };
}

/** Ostatnia wysyłka paczek (do wiersza klienta). */
export async function loadRolLastSends(batchIds: readonly string[]): Promise<Map<string, { sentAt: string; from: string }>> {
  if (!batchIds.length) return new Map();
  const res = await query<{ batch_id: string; sent_at: string; from_address: string }>(
    `SELECT DISTINCT ON (batch_id) batch_id, sent_at::text, from_address FROM rol_sends
      WHERE batch_id = ANY($1::uuid[]) ORDER BY batch_id, sent_at DESC`,
    [[...batchIds]]
  );
  return new Map(res.rows.map((r) => [r.batch_id, { sentAt: r.sent_at, from: r.from_address }]));
}
