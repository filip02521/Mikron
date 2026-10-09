/** Jednorazowy komunikat przy potwierdzaniu odbioru towaru z regału (sesja przeglądarki). */

export const MY_ORDER_PICKUP_SHELF_NOTICE = {
  title: "Ten towar czeka na regale dla Ciebie",
  headline: "Zaznacz to w zamówieniu klienta",
  lead:
    "Magazyn odłożył te sztuki osobno, specjalnie pod Twoją prośbę.",
  detail:
    "Dopisz w zamówieniu, że chodzi o towar z regału - wtedy kompletujący weźmie właśnie te sztuki.",
  confirmLabel: "Potwierdzam odbiór",
  cancelLabel: "Wróć",
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
