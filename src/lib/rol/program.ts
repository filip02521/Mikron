/** Walidacja ustawień klienta ROL (okno „Ustawienia ROL”) — granica zaufania dla akcji serwera. */

import type { SubiektKontrahent } from "@/lib/subiekt/types";
import { ROL_FREQUENCIES, type RolFrequency } from "./constants";

export type RolProgramInput = {
  id?: string | null;
  label: string;
  fileLabel: string;
  khIds: string;
  discountPct: string;
  addressLines: string;
  nip: string;
  toEmails: string;
  ccEmails: string;
  active: boolean;
  reportFrequency: string;
};

export type RolProgramValues = {
  id: string | null;
  label: string;
  fileLabel: string;
  khIds: number[];
  discountPct: number;
  addressLines: string[];
  nip: string;
  toEmails: string[];
  ccEmails: string[];
  active: boolean;
  reportFrequency: RolFrequency;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

const splitList = (s: string) =>
  s
    .split(/[\s,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);

function parseEmails(raw: string, field: string): string[] | string {
  const list = [...new Set(splitList(raw).map((e) => e.toLowerCase()))];
  const bad = list.find((e) => !EMAIL_RE.test(e));
  return bad ? `${field}: „${bad}” nie wygląda na adres e-mail.` : list;
}

export function parseRolProgramInput(input: RolProgramInput): { ok: true; value: RolProgramValues } | { ok: false; error: string } {
  const id = input.id?.trim() || null;
  if (id && !UUID_RE.test(id)) return { ok: false, error: "Nieprawidłowy identyfikator klienta ROL." };
  const label = input.label.trim();
  if (!label || label.length > 120) return { ok: false, error: "Podaj nazwę klienta (do 120 znaków), np. „Przykładowa”." };
  const fileLabel = input.fileLabel.trim() || label;
  if (fileLabel.length > 80 || /[\\/:*?"<>|]/.test(fileLabel)) {
    return { ok: false, error: "Nazwa w plikach może mieć do 80 znaków, bez znaków \\ / : * ? \" < > |." };
  }
  const khRaw = splitList(input.khIds);
  const khIds = [...new Set(khRaw.map((x) => Number(x)))];
  if (!khRaw.length || khIds.some((n) => !Number.isInteger(n) || n <= 0)) {
    return { ok: false, error: "Podaj numer kartoteki klienta w Subiekcie (kh_Id), kilka oddziel przecinkiem." };
  }
  const discountPct = Number(input.discountPct.replace(",", "."));
  if (!(discountPct > 0 && discountPct < 100)) return { ok: false, error: "Rabat musi być liczbą między 0 a 100 (np. 25)." };
  const to = parseEmails(input.toEmails, "Do");
  if (typeof to === "string") return { ok: false, error: to };
  const cc = parseEmails(input.ccEmails, "DW");
  if (typeof cc === "string") return { ok: false, error: cc };
  const reportFrequency = ROL_FREQUENCIES.find((f) => f === input.reportFrequency);
  if (!reportFrequency) return { ok: false, error: "Wybierz, co ile wysyłać raport: miesiąc, 2 tygodnie albo tydzień." };
  return {
    ok: true,
    value: {
      id,
      label,
      fileLabel,
      khIds,
      discountPct,
      addressLines: input.addressLines
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 4),
      nip: input.nip.trim().slice(0, 32),
      toEmails: to,
      ccEmails: cc,
      active: input.active === true,
      reportFrequency,
    },
  };
}

/**
 * Wybór kartoteki z Subiekta w oknie „Ustawienia ROL”: dopisuje kh_Id do listy, a nazwę, adres
 * i NIP wpisuje tylko w puste pola — druga kartoteka tego samego klienta nie nadpisuje danych.
 */
export function applyKontrahentToRolInput(
  form: RolProgramInput,
  k: SubiektKontrahent
): { form: RolProgramInput; filled: string[] } {
  const t = (s?: string | null) => s?.trim() ?? "";
  const kh = Math.trunc(Number(k.kh_Id));
  const khIds = splitList(form.khIds);
  const label = (t(k.adr_Nazwa) || t(k.adr_NazwaPelna)).slice(0, 120);
  const address = [t(k.adr_Adres) || t(k.adr_Ulica), [t(k.adr_Kod), t(k.adr_Miejscowosc)].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join("\n");
  const nip = t(k.adr_NIP).slice(0, 32);
  const next = { ...form };
  const filled: string[] = [];
  if (kh > 0 && !khIds.includes(String(kh))) {
    next.khIds = [...khIds, String(kh)].join(", ");
    filled.push(`kartoteka ${kh}`);
  }
  if (!form.label.trim() && label) {
    next.label = label;
    filled.push("nazwa");
  }
  if (!form.addressLines.trim() && address) {
    next.addressLines = address;
    filled.push("adres");
  }
  if (!form.nip.trim() && nip) {
    next.nip = nip;
    filled.push("NIP");
  }
  return { form: next, filled };
}
