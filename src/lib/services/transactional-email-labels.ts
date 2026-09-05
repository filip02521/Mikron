import type { TransactionalEmailKind } from "@/types/database";

export const TRANSACTIONAL_EMAIL_KIND_LABELS: Record<TransactionalEmailKind, string> = {
  delivery: "Dostawa (towar na regale)",
  informacja: "Informacja — na magazynie",
  procurement_cancel: "Anulowanie prośby",
  request_note_update: "Zmiana uwag",
  board_reply: "Tablica — odpowiedź",
  password_reset_otp: "Reset hasła (OTP)",
  generic: "Inny",
  attachments: "Z załącznikami",
};
