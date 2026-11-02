import { THEME_SCRIPT } from "@/lib/auth/theme";

/** Inline w <head> — motyw z cookie / localStorage przed pierwszym malowaniem (bez mignięcia jasnym). */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
