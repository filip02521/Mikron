"use client";

import type { MyOrderHeadlineTone } from "@/lib/orders/my-order-sales-ui";
import { cn } from "@/lib/cn";

const toneStyles: Record<
  MyOrderHeadlineTone,
  { wrap: string; title: string; sub: string }
> = {
  action: {
    wrap: "bg-emerald-600 text-white",
    title: "text-white",
    sub: "text-emerald-100",
  },
  warning: {
    wrap: "bg-amber-50 text-amber-950",
    title: "text-amber-950",
    sub: "text-amber-800",
  },
  success: {
    wrap: "bg-emerald-50 text-emerald-950",
    title: "text-emerald-900",
    sub: "text-emerald-800",
  },
  info: {
    wrap: "bg-indigo-50 text-indigo-950",
    title: "text-indigo-900",
    sub: "text-indigo-800",
  },
  neutral: {
    wrap: "bg-slate-50 text-slate-800",
    title: "text-slate-900",
    sub: "text-slate-600",
  },
};

export function MyOrderHeadlineBanner({
  headline,
  subline,
  tone,
}: {
  headline: string;
  subline?: string | null;
  tone: MyOrderHeadlineTone;
}) {
  const s = toneStyles[tone];
  return (
    <div className={cn("border-b border-slate-100 px-3.5 py-2.5", s.wrap)}>
      <p className={cn("text-sm font-bold leading-snug", s.title)}>{headline}</p>
      {subline ? (
        <p className={cn("mt-0.5 text-xs leading-relaxed", s.sub)}>{subline}</p>
      ) : null}
    </div>
  );
}
