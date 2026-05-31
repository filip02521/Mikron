export type AuthVisualVariant = 'original' | 'bridge' | 'minimal';

/**
 * Aktywny wariant szaty graficznej ekranów auth.
 * original — pierwsza wersja: blur + tarcze, prosty podział paneli
 * bridge   — most falisty między panelami
 * minimal  — same linie w rogach, bez blur
 */
export const AUTH_VISUAL_VARIANT: AuthVisualVariant = 'original';

export function isAuthVisualVariant(variant: AuthVisualVariant): boolean {
  return AUTH_VISUAL_VARIANT === variant;
}
