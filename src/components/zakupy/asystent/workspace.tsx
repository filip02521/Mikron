import Link from "next/link";
import type { ReactNode } from "react";
import { IconChevronLeft } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";

const focusRingClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45";

/**
 * Panel Asystenta: od lg lista i treść obok siebie na całej wysokości ekranu, widoki jako pasek nad nimi;
 * od 2xl widoki w pionowej szynie z lewej. Niżej jeden stos (lista albo treść, jak w programie pocztowym).
 */
export const workspaceGridClass =
  "relative grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] 2xl:grid-cols-[14rem_minmax(0,24rem)_minmax(0,1fr)] 2xl:grid-rows-[minmax(0,1fr)]";

/** Szyna: drugi odcień neutralny (Studnia) — oddziela nawigację od treści bez obramowań. */
export const railClass =
  "col-span-full flex min-w-0 flex-col gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-x-6 lg:gap-y-2 2xl:col-span-1 2xl:flex-nowrap 2xl:flex-col 2xl:items-stretch 2xl:justify-start 2xl:gap-3 2xl:border-b-0 2xl:border-r 2xl:py-3";

/** Lista: przewija się osobno od lg; na telefonie rośnie z treścią. */
export const listColumnClass = "min-h-0 border-slate-200 lg:overflow-y-auto lg:border-r";

/**
 * Zakładki widoków w szynie: przewijają się w poziomie aż do 2xl (od lg nie mieszczą się obok przełącznika
 * na 1024 px); p-0.5 — przewijany pasek nie ucina pierścienia aktywnej pozycji. Bez suwaka, jak inne
 * przewijane rzędy zakładek (panel dzienny): na telefonie leżał pod zakładkami jak szara kreska.
 */
export const railTabsClass =
  "flex min-w-0 gap-1 overflow-x-auto p-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden 2xl:flex-col 2xl:overflow-visible";

export const railGroupLabelClass ="px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500";

/** Pozycja szyny: aktywna jak segment (biała, lekki cień) — ten sam język co przełączniki w aplikacji. */
export function railItemClass(active: boolean): string {
  return cn(
    focusRingClass,
    "flex shrink-0 items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors duration-150 active:scale-[0.98] motion-reduce:active:scale-100 2xl:py-2",
    active
      ? "bg-white text-slate-900 shadow-[var(--shadow-card)] ring-1 ring-slate-200/80"
      : "text-slate-600 hover:bg-white/70 hover:text-slate-900",
  );
}

/** Licznik w pozycji szyny: bursztyn = czeka na reakcję, petrol = informacja, szary = reszta. */
export function RailCount({ value, tone = "neutral" }: { value: number; tone?: "attention" | "info" | "neutral" }) {
  return (
    <span
      className={cn(
        "min-w-5 rounded-full px-1.5 py-px text-center text-[11px] font-medium tabular-nums",
        tone === "attention" && value
          ? "bg-amber-100 text-amber-900"
          : tone === "info" && value
            ? "bg-indigo-100 text-indigo-900"
            : "bg-slate-200/70 text-slate-600",
      )}
    >
      {value}
    </span>
  );
}

/** Wiersz listy: zaznaczenie = Petrol Mist + 3 px pasek z lewej (jak wybrany wiersz tabeli). */
export function listRowClass(selected: boolean): string {
  return cn(
    "block w-full px-4 py-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/45",
    selected ? "bg-indigo-50/70 shadow-[inset_3px_0_0_var(--primary)]" : "hover:bg-slate-50 active:bg-slate-100",
  );
}

type Back = { href: string } | { onClick: () => void };

/** Nagłówek treści: na telefonie link „Lista” nad tytułem, akcje po prawej. */
export function DetailHeader({
  title,
  subtitle,
  back,
  actions,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back: Back;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const backClass =
    "mb-2 inline-flex min-h-8 items-center gap-1 rounded-md pr-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 lg:hidden";
  return (
    <header className="border-b border-slate-200 px-4 py-3 sm:px-5">
      {"href" in back ? (
        <Link href={back.href} className={backClass}>
          <IconChevronLeft size={16} aria-hidden /> Lista
        </Link>
      ) : (
        <button type="button" onClick={back.onClick} className={backClass}>
          <IconChevronLeft size={16} aria-hidden /> Lista
        </button>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        {/* min-w: tytuł nie ściska się do słowa w wierszu — akcje schodzą pod niego, gdy brakuje miejsca */}
        <div className="min-w-[14rem] flex-1">
          <h3 className="text-base font-semibold tracking-tight text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p> : null}
          {/* Stan (odznaki) przy tytule — na telefonie akcje schodzą pod niego, nie między tytuł a stan. */}
          {children}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-1.5">{actions}</div> : null}
      </div>
    </header>
  );
}

/** Pusta treść (nic nie wybrano / nic w widoku) — uczy, co zrobić. */
export function DetailEmpty({
  icon,
  title,
  hint,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  hint?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[18rem] flex-col items-center justify-center px-6 py-10 text-center", className)}>
      <div className="mb-2 text-slate-400">{icon}</div>
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {hint ? <p className="mt-1 max-w-xs text-sm leading-relaxed text-slate-500">{hint}</p> : null}
      {children}
    </div>
  );
}

/** Drobna akcja tekstowa w nagłówku treści (link do karty, przekazanie). */
export const detailLinkClass =
  "inline-flex min-h-8 items-center rounded-md px-2 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-50 hover:text-indigo-900";
