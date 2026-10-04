import { cn } from "@/lib/cn";
import { polishPluralWord } from "@/lib/email/polish-plural";

/** Lista kont — mieści się w widoku razem z hasłem, błędem i przyciskiem. */
export const LOGIN_ACCOUNT_LISTBOX_CLASS =
  "min-h-0 max-h-44 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] sm:max-h-52 [@supports(height:100dvh)]:max-h-[min(13rem,calc(100dvh-26rem))] [@supports(height:100dvh)]:sm:max-h-[min(15rem,calc(100dvh-23rem))]";

export const LOGIN_ACCOUNT_LIST_WRAPPER_CLASS =
  "overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm shadow-slate-200/30";

/** Wyszukiwarka pojawia się wcześniej — na mobile lista szybciej rośnie. */
export const LOGIN_ACCOUNT_SEARCH_THRESHOLD = 4;

export function loginAccountInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase() || "?";
}

export function loginAccountCountLabel(count: number): string {
  return `${count} ${polishPluralWord(count, "konto", "konta", "kont")}`;
}

export function loginAccountRowClass({
  active,
  focused,
  disabled,
}: {
  active: boolean;
  focused: boolean;
  disabled: boolean;
}): string {
  return cn(
    "flex w-full min-h-[3.25rem] cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors sm:min-h-12",
    "focus-visible:outline-none",
    active
      ? "border-l-[3px] border-l-indigo-500 bg-indigo-50/75 pl-[calc(0.75rem-3px)]"
      : "border-l-[3px] border-l-transparent pl-[calc(0.75rem-3px)]",
    !active && focused && "bg-slate-50/90",
    !active && !focused && "hover:bg-slate-50/70",
    disabled && "cursor-not-allowed opacity-60"
  );
}

export function loginAccountAvatarClass(active: boolean): string {
  return cn(
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1",
    active
      ? "bg-indigo-100 text-indigo-700 ring-indigo-200/80"
      : "bg-slate-100 text-slate-600 ring-slate-200/80"
  );
}
