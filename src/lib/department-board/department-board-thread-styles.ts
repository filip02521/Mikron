import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";

/** Etykieta autora odpowiedzi zakupów w wątku pytań. */
export const BOARD_PROCUREMENT_AUTHOR_LABEL = "Dział zakupów";

/** Lista wątków pytań — zebra na zwiniętych wierszach zamiast divide-y. */
export const boardQuestionListClass =
  "overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/25 shadow-sm ring-1 ring-slate-900/[0.03]";

/** Lista ogłoszeń — ten sam kontener co pytania. */
export const boardAnnouncementListClass = boardQuestionListClass;

export function boardAnnouncementRowClass(opts: {
  unread: boolean;
  pinned: boolean;
}): string {
  return cn(
    "bg-white px-3 py-3.5 transition-[background-color,box-shadow] duration-200 sm:px-4 sm:py-4",
    opts.unread
      ? "bg-indigo-50/40 ring-1 ring-inset ring-indigo-200/55"
      : opts.pinned
        ? "bg-indigo-50/20 hover:bg-indigo-50/30"
        : "hover:bg-slate-50/70"
  );
}

export function boardAnnouncementRoleBadgeClass(): string {
  return "inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide leading-none text-indigo-900";
}

export function boardAnnouncementAvatarClass(opts: {
  unread: boolean;
  pinned: boolean;
}): string {
  return cn(
    "flex size-9 shrink-0 items-center justify-center rounded-full ring-1",
    opts.unread
      ? "bg-indigo-100 text-indigo-800 ring-indigo-200/80"
      : opts.pinned
        ? "bg-indigo-100 text-indigo-800 ring-indigo-200/80"
        : "bg-slate-100 text-slate-600 ring-slate-200/80"
  );
}

export function boardQuestionRowClass(opts: {
  unseen: boolean;
  open: boolean;
  expanded: boolean;
  /** Co drugi wiersz (index % 2 === 1) — tylko gdy zwinięty. */
  alternate?: boolean;
}): string {
  const alt = opts.alternate ?? false;

  if (opts.expanded) {
    return cn(
      "relative z-[1] border-l-2 border-l-indigo-400/80 bg-white shadow-md ring-1 ring-indigo-200/70",
      "transition-[background-color,box-shadow,ring-color,border-color] duration-300 ease-out motion-reduce:transition-none"
    );
  }

  const accent = opts.unseen
    ? "border-l-2 border-l-indigo-500/85"
    : opts.open
      ? "border-l-2 border-l-amber-400/80"
      : "border-l-2 border-l-indigo-300/50";

  if (opts.unseen) {
    return cn(
      accent,
      "transition-[background-color,box-shadow,ring-color,border-color] duration-200 ease-out motion-reduce:transition-none",
      alt
        ? "bg-indigo-50/35 hover:bg-indigo-50/45"
        : "bg-indigo-50/18 hover:bg-indigo-50/30",
      "ring-1 ring-inset ring-indigo-200/50"
    );
  }

  if (opts.open) {
    return cn(
      accent,
      "transition-[background-color,box-shadow,ring-color,border-color] duration-200 ease-out motion-reduce:transition-none",
      alt
        ? "bg-amber-50/28 hover:bg-amber-50/38"
        : "bg-amber-50/14 hover:bg-amber-50/26"
    );
  }

  return cn(
    accent,
    "transition-[background-color,box-shadow,ring-color,border-color] duration-200 ease-out motion-reduce:transition-none",
    alt
      ? "bg-slate-100/45 hover:bg-slate-100/65"
      : "bg-white hover:bg-slate-50/90"
  );
}

export const boardQuestionRowHeaderExpandedClass =
  "border-b border-indigo-100/70 bg-gradient-to-r from-indigo-50/35 via-white to-white";

export const boardQuestionUnseenDotClass = "h-2 w-2 shrink-0 rounded-full bg-indigo-500";

export function boardQuestionStatusBadgeClass(opts: {
  unseen: boolean;
  open: boolean;
}): string {
  return cn(
    "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide leading-none",
    opts.open
      ? "bg-amber-100 text-amber-900 ring-1 ring-amber-200/70"
      : opts.unseen
        ? "bg-indigo-100 text-indigo-900 ring-1 ring-indigo-200/70"
        : "bg-slate-100 text-slate-600 ring-1 ring-slate-200/70"
  );
}

export const boardQuestionPreviewClass = cn(
  salesTypography.rowBody,
  "block truncate text-[12px] leading-snug text-slate-500/90"
);

export const boardQuestionCollapsedMetaClass = "text-slate-600/95";

/** Imię autora pytania — zwykły tekst w kolorze marki. */
export const boardQuestionAuthorNameClass = "font-semibold text-indigo-700";

export function boardThreadAuthorNameClass(tone: BoardThreadMessageTone): string {
  return cn(
    "text-xs font-semibold",
    tone === "question"
      ? "text-amber-800"
      : tone === "procurement"
        ? "text-indigo-800"
        : "text-slate-700"
  );
}

export const boardQuestionProductChipClass =
  "inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200/90 bg-slate-100/80 px-2 py-0.5 text-[11px] font-semibold text-slate-700";

export const boardQuestionProductContextClass =
  "rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2.5";

export type BoardThreadMessageTone = "question" | "procurement" | "sales";

export function boardThreadMessageShellClass(tone: BoardThreadMessageTone): string {
  return cn(
    "rounded-xl border px-3.5 py-3 shadow-sm transition-shadow duration-200",
    tone === "question"
      ? "border-amber-200/70 bg-gradient-to-br from-amber-50/80 via-white to-white"
      : tone === "procurement"
        ? "border-indigo-200/75 bg-gradient-to-br from-indigo-50/90 via-indigo-50/35 to-white"
        : "border-slate-200/80 bg-slate-50/70"
  );
}

export function boardThreadAvatarClass(tone: BoardThreadMessageTone): string {
  return cn(
    "flex size-9 shrink-0 items-center justify-center rounded-full ring-1",
    tone === "question"
      ? "bg-amber-100 text-amber-800 ring-amber-200/80"
      : tone === "procurement"
        ? "bg-indigo-100 text-indigo-800 ring-indigo-200/80"
        : "bg-slate-100 text-slate-600 ring-slate-200/80"
  );
}

export function boardThreadRoleBadgeClass(tone: BoardThreadMessageTone): string {
  return cn(
    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide leading-none",
    tone === "question"
      ? "bg-amber-100 text-amber-900"
      : tone === "procurement"
        ? "bg-indigo-100 text-indigo-900"
        : "bg-slate-200/80 text-slate-700"
  );
}

export const boardReplyFormShellClass =
  "space-y-2 rounded-xl border border-indigo-200/70 bg-indigo-50/25 px-3.5 py-3 shadow-sm";

export const boardAwaitingReplyClass = cn(
  salesTypography.rowMeta,
  "rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3.5 py-2.5 italic text-slate-500"
);

export const boardQuestionFabClass =
  "fixed z-50 flex h-12 min-w-12 items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

/** Licznik na chipie filtra / zakładce tablicy. */
export function boardChipCountBadgeClass(opts: {
  active?: boolean;
  emphasis?: "default" | "warning" | "action";
}): string {
  if (opts.active) {
    return "inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-indigo-600 px-1.5 py-0.5 tabular-nums text-[10px] font-bold leading-none text-white";
  }
  if (opts.emphasis === "warning") {
    return "inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-amber-100 px-1.5 py-0.5 tabular-nums text-[10px] font-bold leading-none text-amber-900";
  }
  if (opts.emphasis === "action") {
    return "inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-indigo-100 px-1.5 py-0.5 tabular-nums text-[10px] font-bold leading-none text-indigo-900";
  }
  return "inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-slate-100 px-1.5 py-0.5 tabular-nums text-[10px] font-bold leading-none text-slate-600";
}
