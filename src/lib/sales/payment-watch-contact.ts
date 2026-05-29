import type { SubiektDocument, SubiektKontrahent } from "@/lib/subiekt/types";
import { cleanSubiektText, pickKhIdFromDocument } from "@/lib/subiekt/zk-document";
import type { SalesPaymentWatch } from "@/types/database";

export type PaymentWatchClientContact = {
  email: string | null;
  phone: string | null;
};

function readKontrahentPhone(k: SubiektKontrahent): string | null {
  const raw = k as Record<string, unknown>;
  const candidates = [
    raw.adr_Telefon,
    raw.kh_Telefon,
    raw.adr_Tel,
    raw.kh_Tel,
    raw.adr_Telefon1,
  ];
  for (const value of candidates) {
    const cleaned = cleanSubiektText(typeof value === "string" ? value : null);
    if (cleaned) return cleaned;
  }
  return null;
}

function contactFromKontrahent(k: SubiektKontrahent): PaymentWatchClientContact {
  return {
    email: cleanSubiektText(k.kh_EMail),
    phone: readKontrahentPhone(k),
  };
}

function mergeContact(
  base: PaymentWatchClientContact,
  next: PaymentWatchClientContact
): PaymentWatchClientContact {
  return {
    email: base.email ?? next.email,
    phone: base.phone ?? next.phone,
  };
}

/** E-mail / telefon kontrahenta z zapisanego snapshotu Subiekta. */
export function extractPaymentWatchClientContact(
  watch: SalesPaymentWatch
): PaymentWatchClientContact {
  const snap = watch.subiekt_snapshot as SubiektDocument | null;
  if (!snap) return { email: null, phone: null };

  const targetId =
    watch.client_kh_id != null
      ? Math.trunc(watch.client_kh_id)
      : pickKhIdFromDocument(snap);

  const blocks = [snap.kh__Kontrahent_Odbiorca, snap.kh__Kontrahent_Platnik].filter(
    (k): k is SubiektKontrahent => k != null
  );

  let contact: PaymentWatchClientContact = { email: null, phone: null };

  if (targetId != null) {
    for (const k of blocks) {
      if (Math.trunc(Number(k.kh_Id)) === targetId) {
        contact = mergeContact(contact, contactFromKontrahent(k));
      }
    }
  }

  for (const k of blocks) {
    contact = mergeContact(contact, contactFromKontrahent(k));
  }

  return contact;
}

export function normalizePhoneHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return `tel:${phone}`;
  if (digits.length === 9) return `tel:+48${digits}`;
  if (digits.length === 11 && digits.startsWith("48")) return `tel:+${digits}`;
  return `tel:+${digits}`;
}
