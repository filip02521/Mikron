"use client";

import { cn } from "@/lib/cn";
import { mojeSectionDomId } from "@/lib/orders/moje-section-focus";
import type { MojeSectionIconKind } from "@/components/icons/StrokeIcons";

export type MojeSectionJumpItem = {
  icon: MojeSectionIconKind;
  label: string;
  count: number;
  /** Sekcja wymaga reakcji handlowca (odbiór, potwierdzenie). */
  needsAction?: boolean;
};

/**
 * Skróty do sekcji listy — od razu widać, ile jest w każdym etapie,
 * i jednym kliknięciem przechodzi się do sekcji (zamiast legendy kolorów).
 */
export function MojeSectionJumpNav({
  items,
  className,
}: {
  items: MojeSectionJumpItem[];
  className?: string;
}) {
  const visible = items.filter((item) => item.count > 0);
  if (visible.length === 0) return null;

  const jump = (icon: MojeSectionIconKind) => {
    const el = document.getElementById(mojeSectionDomId(icon));
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      aria-label="Sekcje listy"
      className={cn(
        "-mx-3 flex gap-2 overflow-x-auto px-3 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {visible.map((item) => (
        <button
          key={item.icon}
          type="button"
          onClick={() => jump(item.icon)}
          className={cn(
            "inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 text-sm font-medium transition-colors",
            item.needsAction
              ? "border-indigo-200 bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
              : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:text-indigo-800",
          )}
        >
          {item.label}
          <span
            className={cn(
              "rounded-full px-1.5 text-xs font-bold tabular-nums",
              item.needsAction ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700",
            )}
          >
            {item.count}
          </span>
        </button>
      ))}
    </nav>
  );
}
