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
    // Zwinięta sekcja („Przed zamówieniem”) rozwija się przy przejściu ze skrótu.
    window.dispatchEvent(new CustomEvent("moje:open-section", { detail: icon }));
    requestAnimationFrame(() => {
      document
        .getElementById(mojeSectionDomId(icon))
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
            "inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 text-[13px] transition-colors hover:border-slate-300 hover:bg-slate-50",
            item.needsAction ? "font-semibold text-slate-900" : "font-medium text-slate-600",
          )}
        >
          {item.needsAction ? (
            <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
          ) : null}
          {item.label}
          <span className="tabular-nums text-slate-400">{item.count}</span>
        </button>
      ))}
    </nav>
  );
}
