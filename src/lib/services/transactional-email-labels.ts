import type { TransactionalEmailKind } from "@/types/database";

export const TRANSACTIONAL_EMAIL_KIND_LABELS: Record<TransactionalEmailKind, string> = {
  delivery: "Dostawa (towar na regale)",
  informacja: "Informacja - na magazynie",
  procurement_cancel: "Anulowanie prośby",
  request_note_update: "Zmiana uwag",
  board_reply: "Tablica - odpowiedź",
  password_reset_otp: "Reset hasła (OTP)",
  generic: "Inny",
  attachments: "Z załącznikami",
  supplier_order: "Zamówienie do dostawcy (Gmail)",
  supplier_inquiry: "Zapytanie do dostawcy z tablicy (Gmail)",
  supplier_reply: "Odpowiedź do dostawcy z Poczty dostawców (Gmail)",
};
