export type LoginSubtitleMode = "quick" | "picker" | "manual";

export const LOGIN_SUBTITLE_QUICK = "Podaj hasło, aby kontynuować.";
export const LOGIN_SUBTITLE_PICKER = "Wybierz swoje konto firmowe i podaj hasło.";
export const LOGIN_SUBTITLE_MANUAL = "Podaj adres e-mail firmowy i hasło.";

export function loginSubtitleForMode(mode: LoginSubtitleMode): string {
  switch (mode) {
    case "quick":
      return LOGIN_SUBTITLE_QUICK;
    case "manual":
      return LOGIN_SUBTITLE_MANUAL;
    default:
      return LOGIN_SUBTITLE_PICKER;
  }
}
