"use server";

import { requireSalesAccount } from "@/lib/auth";
import {
  createSubiektZk,
  getSubiektZkFromZkHost,
  resolveSubiektIssuerId,
  searchSubiektZkHostClients,
  searchSubiektZkHostProducts,
  zkHostConfigOrThrow,
} from "@/lib/subiekt/api";
import { resolveSubiektZkConfig } from "@/lib/subiekt/config";
import { parseCustomerMail } from "@/lib/sales/zk-from-mail/parse";
import {
  matchZkMail,
  toClientOption,
  toProductOption,
  ZK_MATCH_MAX_CANDIDATES,
  type ZkClientOption,
  type ZkMailMatch,
  type ZkMatchDeps,
  type ZkProductOption,
} from "@/lib/sales/zk-from-mail/match";
import {
  previewSymbols,
  zkCreateFailure,
  validateZkCreateRequest,
  zkReadbackMismatches,
  type ZkMailCreateRequest,
} from "@/lib/sales/zk-from-mail/create";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

const MAX_MAIL_CHARS = 20_000;
/** Dłuższy mail to raczej cennik niż zamówienie — bez tego 200 linii = setki zapytań do Subiekta. */
const MAX_MAIL_LINES = 30;

const deps: ZkMatchDeps = {
  searchProducts: (params) => searchSubiektZkHostProducts(params),
  searchClients: (params) => searchSubiektZkHostClients(params),
};

export type ZkMailAnalyzeResult =
  | ({ ok: true; senderEmail: string | null; skippedLines: number } & ZkMailMatch)
  | { ok: false; message: string };

/** Czyta wklejony mail i proponuje klienta i pozycje. Nic nie zapisuje. */
export async function actionZkMailAnalyze(text: string): Promise<ZkMailAnalyzeResult> {
  await requireSalesAccount("read");
  const raw = String(text ?? "");
  if (!raw.trim()) return { ok: false, message: "Wklej treść maila." };
  if (raw.length > MAX_MAIL_CHARS) return { ok: false, message: "Mail jest za długi. Wklej samą treść zamówienia, bez cytatów i stopki." };
  const zkHost = resolveSubiektZkConfig();
  if (!zkHost.ok) return { ok: false, message: zkHost.message };

  const parsed = parseCustomerMail(raw);
  const lines = parsed.lines.slice(0, MAX_MAIL_LINES);
  try {
    const match = await matchZkMail({ ...parsed, lines }, deps);
    return { ok: true, senderEmail: parsed.senderEmail, skippedLines: parsed.lines.length - lines.length, ...match };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się połączyć z Subiektem. Spróbuj ponownie za chwilę.") };
  }
}

function validQuery(query: string): string | null {
  const q = String(query ?? "").trim();
  return q.length >= 2 && q.length <= 80 ? q : null;
}

export async function actionZkMailSearchProducts(
  query: string
): Promise<{ ok: true; items: ZkProductOption[] } | { ok: false; message: string }> {
  await requireSalesAccount("read");
  const q = validQuery(query);
  if (!q) return { ok: false, message: "Wpisz co najmniej 2 znaki." };
  try {
    const items = (await searchSubiektZkHostProducts({ search: q, pageSize: 10 })).filter((p) => !p.tw_Zablokowany);
    return { ok: true, items: items.map(toProductOption) };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się wyszukać towaru.") };
  }
}

export async function actionZkMailSearchClients(
  query: string
): Promise<{ ok: true; items: ZkClientOption[] } | { ok: false; message: string }> {
  await requireSalesAccount("read");
  const q = validQuery(query);
  if (!q) return { ok: false, message: "Wpisz co najmniej 2 znaki." };
  try {
    const items = await searchSubiektZkHostClients({ search: q, pageSize: ZK_MATCH_MAX_CANDIDATES * 2 });
    return { ok: true, items: items.map(toClientOption) };
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e, "Nie udało się wyszukać klienta.") };
  }
}

export type ZkMailCreateResult =
  | { ok: true; dokId: number; numer: string; clientName: string; lineCount: number; mismatches: string[] }
  | { ok: false; message: string; uncertain?: boolean };

/** Tworzy ZK w Subiekcie z zatwierdzonego podglądu, potem odczytuje je z powrotem. */
export async function actionZkMailCreate(input: ZkMailCreateRequest): Promise<ZkMailCreateResult> {
  const user = await requireSalesAccount("mutate");
  const validated = validateZkCreateRequest(input ?? { khId: null, lines: null });
  if (!validated.ok) return validated;

  let config;
  try {
    config = zkHostConfigOrThrow();
  } catch (e) {
    return { ok: false, message: userFacingErrorText(e) };
  }

  // Brak pewnego dopasowania konta → „Wystawił” zostaje operatorem Sfery (jak w formularzu testowym).
  const personelId = await resolveSubiektIssuerId(user.email, config, false).catch(() => null);
  const body = { ...validated.body, ...(personelId ? { personelId } : {}) };

  let created;
  try {
    created = await createSubiektZk(body);
  } catch (e) {
    return { ok: false, ...zkCreateFailure(e) };
  }

  const fallbackNumer = created.dok_NrPelny?.trim() || `ZK/${created.dok_Id}`;
  try {
    const doc = await getSubiektZkFromZkHost(created.dok_Id);
    const lines = doc.dok_Pozycja ?? [];
    const client = doc.kh__Kontrahent_Odbiorca ?? doc.kh__Kontrahent_Platnik ?? null;
    return {
      ok: true,
      dokId: created.dok_Id,
      numer: doc.dok_NrPelny?.trim() || fallbackNumer,
      clientName: client ? toClientOption(client).nazwa : "",
      lineCount: lines.length,
      mismatches: zkReadbackMismatches(validated.body, doc, previewSymbols(input?.lines)),
    };
  } catch {
    // ZK powstało — nie każ tworzyć drugiego; brak odczytu pokazujemy jako różnicę do sprawdzenia.
    return {
      ok: true,
      dokId: created.dok_Id,
      numer: fallbackNumer,
      clientName: "",
      lineCount: 0,
      mismatches: ["nie udało się odczytać ZK z Subiekta, sprawdź je w Subiekcie"],
    };
  }
}
