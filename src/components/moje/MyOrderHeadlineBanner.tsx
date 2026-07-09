"use client";

import type { MyOrderHeadlineTone } from "@/lib/orders/my-order-sales-ui";
import { cn } from "@/lib/cn";
import {
  mojeHeadlineInfoSubClass,
  mojeHeadlineInfoTitleClass,
  mojeHeadlineInfoWrapClass,
} from "@/lib/ui/ontime-theme";

const toneStyles: Record<
  MyOrderHeadlineTone,
  { wrap: string; title: string; sub: string }
> = {
  action: {
    wrap: "bg-emerald-600 text-white",
    title: "text-white",
    sub: "text-emerald-100",
  },
  informacja: {
    wrap: "bg-violet-600 text-white",
    title: "text-white",
    sub: "text-violet-100",
  },
  warning: {
    wrap: "bg-amber-50 text-amber-950",
    title: "text-amber-950",
    sub: "text-amber-800",
  },
  stock: {
    wrap: "bg-sky-50 text-sky-950",
    title: "text-sky-950",
    sub: "text-sky-800",
  },
  success: {
    wrap: "bg-emerald-50 text-emerald-950",
    title: "text-emerald-900",
    sub: "text-emerald-800",
  },
  info: {
    wrap: mojeHeadlineInfoWrapClass,
    title: mojeHeadlineInfoTitleClass,
    sub: mojeHeadlineInfoSubClass,
  },
  neutral: {
    wrap: "bg-slate-50 text-slate-800",
    title: "text-slate-900",
    sub: "text-slate-600",
  },
  dismiss: {
    wrap: "bg-rose-50 text-rose-950",
    title: "text-rose-950",
    sub: "text-rose-700",
  },
};

export function MyOrderHeadlineBanner({
  headline,
  subline,
  tone,
  action,
}: {
  headline: string;
  subline?: string | null;
  tone: MyOrderHeadlineTone;
  action?: React.ReactNode;
}) {
  const s = toneStyles[tone];
  return (
    <div className={cn("border-b border-slate-100 px-3 py-2", s.wrap)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs font-semibold leading-snug", s.title)}>{headline}</p>
          {subline && !action ? (
            <p className={cn("mt-0.5 text-[11px] leading-relaxed", s.sub)}>{subline}</p>
          ) : null}
        </div>
        {action}
      </div>
      {subline && action ? (
        <p className={cn("mt-0.5 text-[11px] leading-relaxed", s.sub)}>{subline}</p>
      ) : null}
    </div>
  );
}
