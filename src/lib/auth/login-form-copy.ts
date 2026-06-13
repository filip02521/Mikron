export type LoginSubtitleMode = "quick" | "picker" | "manual" | "reset";

export const LOGIN_SUBTITLE_QUICK = "Podaj hasło, aby kontynuować.";
export const LOGIN_SUBTITLE_PICKER = "Wybierz swoje konto firmowe i podaj hasło.";
export const LOGIN_SUBTITLE_MANUAL = "Podaj adres e-mail firmowy i hasło.";
export const LOGIN_SUBTITLE_RESET = "Wpisz 6-cyfrowy kod wysłany na adres powiązany z kontem.";

export function loginSubtitleForMode(mode: LoginSubtitleMode): string {
  switch (mode) {
    case "quick":
      return LOGIN_SUBTITLE_QUICK;
    case "manual":
      return LOGIN_SUBTITLE_MANUAL;
    case "reset":
      return LOGIN_SUBTITLE_RESET;
    default:
      return LOGIN_SUBTITLE_PICKER;
  }
}

export function loginTitleForMode(mode: LoginSubtitleMode): string {
  return mode === "reset" ? "Reset hasła" : "Zaloguj się";
}
