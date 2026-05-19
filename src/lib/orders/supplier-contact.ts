import { orderMethodKind, orderMethodLabel, type OrderMethodKind } from "@/lib/display-labels";

export type SupplierContactLink = {
  kind: "mailto" | "tel" | "url";
  href: string;
  label: string;
};

export type SupplierContactUi = {
  methodLabel: string;
  methodKind: OrderMethodKind;
  /** Główny klikalny kontakt (mail / tel / www) — bez osobnego przycisku „Wyślij mail”. */
  contactLink: SupplierContactLink | null;
  /** Tekst do schowka, gdy nie da się zbudować linku. */
  copyText: string | null;
};

function normalizeContact(mails: string): string {
  return mails.trim();
}

function extractTelHref(contact: string): string | null {
  const digits = contact.replace(/[^\d+]/g, "");
  if (digits.length < 9) return null;
  return `tel:${digits}`;
}

function extractFirstEmail(contact: string): string | null {
  const match = contact.match(/[^\s,;]+@[^\s,;]+/);
  return match ? match[0] : null;
}

function extractFirstUrl(contact: string): string | null {
  const match = contact.match(/https?:\/\/[^\s,;]+/i);
  return match ? match[0] : null;
}

/** Link kontaktu do panelu dziennego i szuflady dostawcy. */
export function buildSupplierContactUi(notes: string, mails: string): SupplierContactUi {
  const methodKind = orderMethodKind(notes);
  const methodLabel = orderMethodLabel(notes);
  const contact = normalizeContact(mails);

  if (!contact) {
    return { methodLabel, methodKind, contactLink: null, copyText: null };
  }

  const email = extractFirstEmail(contact);
  const url = extractFirstUrl(contact);
  const tel = extractTelHref(contact);

  if (methodKind === "mail" && email) {
    return {
      methodLabel,
      methodKind,
      contactLink: { kind: "mailto", href: `mailto:${email}`, label: email },
      copyText: contact,
    };
  }

  if (methodKind === "web" && url) {
    return {
      methodLabel,
      methodKind,
      contactLink: { kind: "url", href: url, label: url.replace(/^https?:\/\//i, "") },
      copyText: contact,
    };
  }

  if (methodKind === "phone" && tel) {
    return {
      methodLabel,
      methodKind,
      contactLink: { kind: "tel", href: tel, label: contact },
      copyText: contact,
    };
  }

  if (email) {
    return {
      methodLabel,
      methodKind,
      contactLink: { kind: "mailto", href: `mailto:${email}`, label: email },
      copyText: contact,
    };
  }

  if (tel) {
    return {
      methodLabel,
      methodKind,
      contactLink: { kind: "tel", href: tel, label: contact },
      copyText: contact,
    };
  }

  if (url) {
    return {
      methodLabel,
      methodKind,
      contactLink: { kind: "url", href: url, label: url.replace(/^https?:\/\//i, "") },
      copyText: contact,
    };
  }

  return { methodLabel, methodKind, contactLink: null, copyText: contact };
}
