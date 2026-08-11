import { orderMethodKind } from "@/lib/display-labels";
import {
  buildSupplierContactUi,
  hasSupplierContactText,
} from "@/lib/orders/supplier-contact";

const METHOD_VALUES = new Set(["MAILOWO", "TELEFONICZNIE", "PRZEZ INTERNET"]);

/**
 * Ujednolica wartość `notes` do kanonicznych opcji selecta.
 * Akceptuje dokładne MAILOWO / TELEFONICZNIE / PRZEZ INTERNET oraz
 * proste synonimy (np. „Telefon”, „MAIL”). Luźnego tekstu z podsłowem
 * (np. „kontakt MAIL do biura”) nie mapuje — zostaje do ręcznego wyboru.
 */
export function canonicalizeOrderMethodNotes(notes: string): string {
  const trimmed = notes.trim();
  if (!trimmed) return "";
  const upper = trimmed.toUpperCase().replace(/\s+/g, " ");
  if (METHOD_VALUES.has(upper)) return upper;

  if (/^(MAIL(OWO)?|E-?MAIL)$/i.test(trimmed)) return "MAILOWO";
  if (/^TELEFON(ICZNIE)?$/i.test(trimmed)) return "TELEFONICZNIE";
  if (/^(INTERNET|PRZEZ INTERNET|WWW|PORTAL)$/i.test(trimmed)) return "PRZEZ INTERNET";

  return trimmed;
}

/** Walidacja pola kontaktu przy zapisie dostawcy (zgodnie ze sposobem zamówienia). */
export function validateSupplierContactFields(
  notes: string,
  mails: string,
  extraInfo?: string
): string | null {
  const method = canonicalizeOrderMethodNotes(notes);
  if (!method || !METHOD_VALUES.has(method)) {
    return "Wybierz sposób zamówienia (mail, telefon lub internet).";
  }

  if (!hasSupplierContactText(mails, extraInfo)) {
    return "Uzupełnij kontakt: e-mail / telefon / stronę w polu kontaktu (lub numer w uwagach przy telefonie).";
  }

  const ui = buildSupplierContactUi(method, mails, extraInfo);
  const kind = orderMethodKind(method);

  if (ui.contactLink) return null;

  if (kind === "mail") {
    return "Przy sposobie „Mail” podaj poprawny adres e-mail (np. zamowienia@dostawca.pl). Sam telefon lub strona nie wystarczy — albo zmień sposób zamówienia.";
  }
  if (kind === "phone") {
    return "Przy sposobie „Telefon” podaj numer (min. 9 cyfr) w polu kontaktu lub w uwagach — sam e-mail / strona nie wystarczy.";
  }
  if (kind === "web") {
    return "Przy sposobie „Internet” podaj adres strony (np. www.sklep.pl lub https://…). Sam e-mail nie wystarczy — albo zmień sposób zamówienia.";
  }

  return "Nie udało się rozpoznać kontaktu — sprawdź format.";
}
