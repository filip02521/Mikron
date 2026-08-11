import { orderMethodKind, orderMethodLabel, type OrderMethodKind } from "@/lib/display-labels";

export type SupplierContactLink = {
  kind: "mailto" | "tel" | "url";
  href: string;
  label: string;
};

export type SupplierContactUi = {
  methodLabel: string;
  methodKind: OrderMethodKind;
  /** Główny klikalny kontakt (mail / tel / www). */
  contactLink: SupplierContactLink | null;
  /** Wyodrębniony e-mail — do kopiowania z badge „Mail”. */
  email: string | null;
  /** Tekst do schowka, gdy nie da się zbudować linku. */
  copyText: string | null;
};

function normalizeContact(value: string): string {
  return value.trim();
}

/** Czy jest jakikolwiek tekst kontaktu (pole główne lub uwagi). */
export function hasSupplierContactText(mails: string, extraInfo?: string): boolean {
  return Boolean(normalizeContact(mails) || normalizeContact(extraInfo ?? ""));
}

/** Składa mails + uwagi — numer telefonu bywa w `extra_info`, a e-mail w `mails`. */
function mergeContactFields(mails: string, extraInfo?: string): string {
  const primary = normalizeContact(mails);
  const secondary = normalizeContact(extraInfo ?? "");
  if (primary && secondary) return `${primary} ${secondary}`;
  return primary || secondary;
}

function extractTelHref(contact: string): string | null {
  const telLabel = contact.match(/tel[.:]?\s*([+\d\s()-]{9,})/i);
  if (telLabel?.[1]) {
    const digits = telLabel[1].replace(/[^\d+]/g, "");
    if (digits.replace(/\D/g, "").length >= 9) return `tel:${digits}`;
  }

  // Pomijamy fragmenty e-mail (cyfry w lokalnej części nie są numerem telefonu).
  const withoutEmails = contact.replace(/[^\s,;]+@[^\s,;]+/g, " ");
  const phoneToken = withoutEmails.match(
    /(?:^|[\s,;/])([+()]?(?:\d[\d\s()-]{7,}\d))/
  );
  const source = phoneToken?.[1] ?? withoutEmails;
  const digits = source.replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length < 9) return null;
  return `tel:${digits}`;
}

function extractFirstEmail(contact: string): string | null {
  const match = contact.match(/[^\s,;]+@[^\s,;]+/);
  return match ? match[0] : null;
}

function displayUrlLabel(href: string): string {
  return href.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

/** Adres strony z lub bez https:// (np. www.sklep.pl, sklep.example.com). */
export function parseWebsiteHref(raw: string): string | null {
  const candidate = raw.trim().split(/[\s,;]+/).find(Boolean);
  if (!candidate || candidate.includes("@")) return null;

  if (/^https?:\/\//i.test(candidate)) {
    try {
      return new URL(candidate).href.replace(/\/$/, "");
    } catch {
      return null;
    }
  }

  if (
    /^(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\/[^\s]*)?$/i.test(
      candidate
    )
  ) {
    try {
      return new URL(`https://${candidate}`).href.replace(/\/$/, "");
    } catch {
      return null;
    }
  }

  return null;
}

function extractFirstUrl(contact: string): string | null {
  const httpMatch = contact.match(/https?:\/\/[^\s,;]+/i);
  if (httpMatch) {
    try {
      return new URL(httpMatch[0]).href.replace(/\/$/, "");
    } catch {
      return httpMatch[0];
    }
  }

  const embedded = contact.match(
    /(?:^|[\s,;])((?:https?:\/\/)?(?:www\.)?[a-z0-9][-a-z0-9.]*\.[a-z]{2,}[^\s,;]*)/i
  );
  if (embedded?.[1]) {
    const parsed = parseWebsiteHref(embedded[1]);
    if (parsed) return parsed;
  }

  return parseWebsiteHref(contact);
}

function pickContactLink(
  methodKind: OrderMethodKind,
  contact: string,
  email: string | null,
  url: string | null,
  tel: string | null
): SupplierContactLink | null {
  if (methodKind === "mail" && email) {
    return { kind: "mailto", href: `mailto:${email}`, label: email };
  }

  if (methodKind === "web") {
    const href = url ?? parseWebsiteHref(contact);
    if (href) {
      return { kind: "url", href, label: displayUrlLabel(href) };
    }
    return null;
  }

  if (methodKind === "phone" && tel) {
    return { kind: "tel", href: tel, label: contact };
  }

  if (methodKind === "other") {
    if (email) return { kind: "mailto", href: `mailto:${email}`, label: email };
    if (tel) return { kind: "tel", href: tel, label: contact };
    if (url) return { kind: "url", href: url, label: displayUrlLabel(url) };
  }

  return null;
}

/** Link kontaktu do panelu dziennego i szuflady dostawcy. */
export function buildSupplierContactUi(
  notes: string,
  mails: string,
  extraInfo?: string
): SupplierContactUi {
  const methodKind = orderMethodKind(notes);
  const methodLabel = orderMethodLabel(notes);
  const contact = mergeContactFields(mails, extraInfo);

  if (!contact) {
    return { methodLabel, methodKind, contactLink: null, email: null, copyText: null };
  }

  const email = extractFirstEmail(contact);
  const url = extractFirstUrl(contact);
  const tel = extractTelHref(contact);
  const contactLink = pickContactLink(methodKind, contact, email, url, tel);

  return {
    methodLabel,
    methodKind,
    contactLink,
    email,
    copyText: contact,
  };
}

/** Legacy: href do użycia w sync / eksporcie — ta sama logika co UI. */
export function formatContactHref(notes: string, mails: string, extraInfo?: string): string {
  const ui = buildSupplierContactUi(notes, mails, extraInfo);
  return ui.contactLink?.href ?? (mergeContactFields(mails, extraInfo) || notes.trim());
}
