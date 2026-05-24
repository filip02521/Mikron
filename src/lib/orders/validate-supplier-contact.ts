import { orderMethodKind } from "@/lib/display-labels";
import {
  buildSupplierContactUi,
  hasSupplierContactText,
} from "@/lib/orders/supplier-contact";

const METHOD_VALUES = new Set(["MAILOWO", "TELEFONICZNIE", "PRZEZ INTERNET"]);

/** Walidacja pola kontaktu przy zapisie dostawcy (zgodnie ze sposobem zamówienia). */
export function validateSupplierContactFields(
  notes: string,
  mails: string,
  extraInfo?: string
): string | null {
  const method = notes.trim().toUpperCase();
  if (!method || !METHOD_VALUES.has(method)) {
    return "Wybierz sposób zamówienia (mail, telefon lub internet).";
  }

  if (!hasSupplierContactText(mails, extraInfo)) {
    return "Uzupełnij „E-mail i strony” lub — przy telefonie — numer w „Dodatkowych informacjach”.";
  }

  const ui = buildSupplierContactUi(notes, mails, extraInfo);
  const kind = orderMethodKind(notes);

  if (ui.contactLink) return null;

  if (kind === "mail") {
    return "Podaj poprawny adres e-mail (np. zamowienia@dostawca.pl).";
  }
  if (kind === "phone") {
    return "Podaj numer telefonu (min. 9 cyfr) w „E-mail i strony” lub w uwagach.";
  }
  if (kind === "web") {
    return "Podaj adres strony (np. www.sklep.pl lub https://…).";
  }

  return "Nie udało się rozpoznać kontaktu — sprawdź format.";
}
