/**
 * Wspólne tokeny UI aplikacji — jedna paleta (indigo + neutral slate).
 * Gradient sky zostaje tylko na ekranach logowania.
 */

/** Tło całej aplikacji (main + shell) */
export const appShellClass = "min-h-screen bg-[var(--background)]";

/** Obszar treści — lekki kontrast względem sidebara */
export const appMainClass = "min-h-screen overflow-y-auto bg-[var(--background)]";

/** Sidebar — biała powierzchnia, spójna z kartami */
export const sidebarShellClass =
  "border-r border-[var(--card-border)] bg-[var(--card)] text-slate-900 shadow-[2px_0_20px_-10px_rgba(15,23,42,0.08)]";

export const sidebarHeaderClass =
  "shrink-0 border-b border-[var(--card-border)] px-4 pb-3 pt-5";

export const sidebarFooterClass =
  "shrink-0 border-t border-[var(--card-border)] bg-slate-50/80 px-3 py-3";

export const sidebarNavScrollClass = "flex-1 overflow-y-auto px-2.5 py-3";

/** Logo w aplikacji — bez gradientu sky (spójne z przyciskami primary) */
export const brandMarkAppClass =
  "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25 ring-1 ring-indigo-500/20";

/** Aktywny link w nawigacji */
export const navLinkActiveClass =
  "bg-indigo-600 text-white shadow-sm shadow-indigo-600/15";

export const navLinkIdleClass =
  "text-slate-700 hover:bg-slate-100/90 hover:text-slate-900";

/** Plakietka roli — neutralna baza + kolorowy akcent */
export function roleBadgeClass(role: string): string {
  const accent: Record<string, string> = {
    admin: "border-l-violet-500",
    zakupy: "border-l-amber-500",
    sales: "border-l-indigo-500",
    sales_manager: "border-l-indigo-400",
  };
  return [
    "inline-flex max-w-full items-center rounded-lg border border-slate-200/90 border-l-[3px] bg-slate-50/80 px-2.5 py-1 text-[10px] font-semibold leading-tight text-slate-700",
    accent[role] ?? "border-l-slate-400",
  ].join(" ");
}

/** Karty treści — jeden promień i cień */
export const surfaceCardClass =
  "rounded-xl border border-[var(--card-border)] bg-[var(--card)] shadow-[0_1px_2px_rgba(15,23,42,0.05)]";
