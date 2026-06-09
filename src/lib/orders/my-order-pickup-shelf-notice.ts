/** Jednorazowy komunikat przy potwierdzaniu odbioru towaru z regału (sesja przeglądarki). */

export const MY_ORDER_PICKUP_SHELF_NOTICE = {
  title: "Towar odłożony na regale pod Twoje zamówienie",
  headline: "Ważna informacja dot. kompletacji!",
  lead:
    "Odznaczasz właśnie towar, który został odłożony osobno na Twoją prośbę.",
  detail:
    "Proszę oznaczyć to w zamówieniu, żeby kompletujący wziął dokładnie te dedykowane sztuki.",
  confirmLabel: "Potwierdzam odbiór",
  cancelLabel: "Anuluj",
} as const;

const SESSION_KEY = "moje-pickup-shelf-notice-seen";

function readSessionFlag(): string | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSessionFlag(): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* Prywatny tryb / wyłączone storage — pomijamy flagę sesji. */
  }
}

function clearSessionFlag(): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function shouldShowPickupShelfNotice(): boolean {
  return readSessionFlag() !== "1";
}

export function markPickupShelfNoticeSeen(): void {
  writeSessionFlag();
}

/** Tylko testy — reset flagi sesji. */
export function resetPickupShelfNoticeForTests(): void {
  clearSessionFlag();
}
