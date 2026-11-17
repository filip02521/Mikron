/**
 * Zatwierdzony podgląd → body `POST /documents/zk/create` i porównanie z ZK odczytanym z Subiekta.
 * Czysta logika (walidacja na granicy zaufania: dane przychodzą z przeglądarki).
 */

import { SubiektNetworkError, SubiektRequestError } from "@/lib/subiekt/errors";
import type { SubiektCreateZkInput, SubiektDocument } from "@/lib/subiekt/types";

export const ZK_MAIL_MAX_LINES = 50;
export const ZK_MAIL_MAX_NOTE = 500;
const MAX_QTY = 100_000;

export type ZkMailCreateRequest = {
  khId: unknown;
  lines: unknown;
  uwagi?: unknown;
};

export type ZkMailCreateLine = { towarId: number; ilosc: number };

/** Symbole z podglądu do komunikatów (tylko do wyświetlenia — Subiekt dostaje towarId). */
export function previewSymbols(lines: unknown): Map<number, string> {
  const out = new Map<number, string>();
  if (!Array.isArray(lines)) return out;
  for (const l of lines as Array<Record<string, unknown>>) {
    const id = positiveInt(l?.towarId);
    const sym = typeof l?.symbol === "string" ? l.symbol.trim().slice(0, 60) : "";
    if (id && sym) out.set(id, sym);
  }
  return out;
}

const positiveInt = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export function validateZkCreateRequest(
  raw: ZkMailCreateRequest
): { ok: true; body: Omit<SubiektCreateZkInput, "personelId"> } | { ok: false; message: string } {
  const khId = positiveInt(raw.khId);
  if (!khId) return { ok: false, message: "Wybierz klienta." };
  if (!Array.isArray(raw.lines) || raw.lines.length === 0) return { ok: false, message: "Dodaj co najmniej jedną pozycję." };
  if (raw.lines.length > ZK_MAIL_MAX_LINES) {
    return { ok: false, message: `Jedno ZK może mieć najwyżej ${ZK_MAIL_MAX_LINES} pozycji.` };
  }
  const pozycje: ZkMailCreateLine[] = [];
  for (const [i, line] of (raw.lines as unknown[]).entries()) {
    const l = (line ?? {}) as Record<string, unknown>;
    const towarId = positiveInt(l.towarId);
    const ilosc = Number(l.ilosc);
    if (!towarId) return { ok: false, message: `Pozycja ${i + 1}: wybierz towar.` };
    if (!Number.isFinite(ilosc) || ilosc <= 0 || ilosc > MAX_QTY) {
      return { ok: false, message: `Pozycja ${i + 1}: wpisz ilość większą od zera.` };
    }
    pozycje.push({ towarId, ilosc: Math.round(ilosc * 100) / 100 });
  }
  const uwagi = String(raw.uwagi ?? "").trim().slice(0, ZK_MAIL_MAX_NOTE);
  return { ok: true, body: { kontrahentId: khId, pozycje, uwagi: uwagi || null } };
}

/** Suma ilości per towar (ZK może mieć ten sam towar w dwóch liniach). */
function qtyByTowar(lines: Array<{ towarId: number | undefined; ilosc: number | null | undefined }>): Map<number, number> {
  const out = new Map<number, number>();
  for (const l of lines) {
    if (!l.towarId) continue;
    out.set(l.towarId, (out.get(l.towarId) ?? 0) + Number(l.ilosc ?? 0));
  }
  return out;
}

/** Co się nie zgadza między wysłanym a odczytanym ZK — pusta lista = zgodne. */
export function zkReadbackMismatches(
  sent: Omit<SubiektCreateZkInput, "personelId">,
  doc: SubiektDocument,
  /** Symbole towarów z podglądu (tw_Id → symbol) — handlowiec nie zna tw_Id. */
  symbols: ReadonlyMap<number, string> = new Map()
): string[] {
  const issues: string[] = [];
  const clientId = doc.dok_OdbiorcaId ?? doc.dok_PlatnikId ?? null;
  if (clientId != null && clientId !== sent.kontrahentId) issues.push("inny klient na ZK");
  const want = qtyByTowar(sent.pozycje.map((p) => ({ towarId: p.towarId, ilosc: p.ilosc })));
  const got = qtyByTowar((doc.dok_Pozycja ?? []).map((p) => ({ towarId: p.ob_TowId, ilosc: p.ob_Ilosc })));
  const docSymbols = new Map((doc.dok_Pozycja ?? []).flatMap((p) => (p.ob_TowId && p.tw_Symbol ? [[p.ob_TowId, String(p.tw_Symbol).trim()] as const] : [])));
  const label = (id: number) => symbols.get(id) || docSymbols.get(id) || `towar nr ${id}`;
  if (!doc.dok_Pozycja) return [...issues, "Subiekt nie zwrócił pozycji ZK"];
  for (const [towarId, qty] of want) {
    const g = got.get(towarId);
    if (g == null) issues.push(`brak na ZK: ${label(towarId)}`);
    else if (Math.abs(g - qty) > 0.001) issues.push(`${label(towarId)}: ${g} zamiast ${qty}`);
  }
  for (const towarId of got.keys()) if (!want.has(towarId)) issues.push(`spoza podglądu: ${label(towarId)}`);
  return issues;
}

/** Powód odrzucenia z treści odpowiedzi Sfery (JSON z error / message / detail), bez kodu wyjątku. */
function sferaReason(body: string): string | null {
  try {
    const j = JSON.parse(body) as Record<string, unknown>;
    const v = [j.error, j.message, j.detail, j.title].find((x) => typeof x === "string" && x.trim());
    return v ? String(v).trim().slice(0, 300) : null;
  } catch {
    return null;
  }
}

/**
 * Błąd create ZK dla handlowca. `uncertain` = Subiekt mógł zapisać ZK, a my nie wiemy (przekroczony czas,
 * zerwane połączenie, 2xx bez numeru) — wtedy ponowienie robi duplikat, więc najpierw sprawdzenie w Subiekcie.
 */
/** Kody i komunikaty z całego łańcucha `cause` (fetch w Node: TypeError → cause.code = ECONNREFUSED). */
function causeChainText(error: unknown): string {
  const parts: string[] = [];
  let e: unknown = error;
  for (let depth = 0; e && depth < 5; depth++) {
    const o = e as { message?: unknown; code?: unknown; cause?: unknown };
    parts.push(String(o.code ?? ""), String(o.message ?? ""));
    e = o.cause;
  }
  return parts.join(" ");
}

const UNCERTAIN_MESSAGE =
  "Subiekt nie potwierdził zapisu. ZK mogło powstać: sprawdź listę ZK klienta w Subiekcie, zanim utworzysz je jeszcze raz.";

export function zkCreateFailure(error: unknown): { message: string; uncertain: boolean } {
  if (error instanceof SubiektRequestError && error.status >= 400) {
    const reason = sferaReason(error.bodySnippet);
    // 503: usługa nie przyjęła żądania. Inne 5xx (500, 502, 504): Sfera mogła zapisać dokument i paść później.
    if (error.status === 503) return { message: "Subiekt jest niedostępny, ZK nie powstało. Spróbuj ponownie za chwilę.", uncertain: false };
    if (error.status >= 500) return { message: reason ? `${UNCERTAIN_MESSAGE} Błąd Subiekta: ${reason}` : UNCERTAIN_MESSAGE, uncertain: true };
    return {
      message: reason ? `Subiekt nie utworzył ZK: ${reason}` : "Subiekt nie utworzył ZK. Sprawdź klienta i pozycje, potem spróbuj ponownie.",
      uncertain: false,
    };
  }
  // Połączenie nie powstało = żądanie nie dotarło, więc ZK na pewno nie ma.
  if (error instanceof SubiektNetworkError && /ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ENETUNREACH/i.test(causeChainText(error))) {
    return { message: "Subiekt jest niedostępny, ZK nie powstało. Spróbuj ponownie za chwilę.", uncertain: false };
  }
  return { message: UNCERTAIN_MESSAGE, uncertain: true };
}
