"use client";

import { useEffect, useState } from "react";
import { AUTH_QUOTES, type AuthQuote } from "@/lib/auth-quotes";
import { cn } from "@/lib/cn";

const ROTATE_MS = 9000;

export function AuthQuotePanel({
  className,
  compact = false,
}: {
  className?: string;
  /** Kompaktowa wersja na telefon — gradient jak panel boczny na desktopie. */
  compact?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % AUTH_QUOTES.length);
        setVisible(true);
      }, 320);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  const quote: AuthQuote = AUTH_QUOTES[index]!;

  if (compact) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900 px-4 py-4 shadow-lg shadow-indigo-900/20",
          className
        )}
      >
        <div
          className="pointer-events-none absolute -right-8 top-0 h-24 w-24 rounded-full bg-indigo-400/20 blur-2xl"
          aria-hidden
        />
        <blockquote
          className={cn(
            "relative text-base font-medium leading-snug tracking-tight text-white transition-all duration-300 ease-out motion-reduce:transition-none",
            visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
          )}
        >
          „{quote.text}”
        </blockquote>
        {quote.attribution ? (
          <p
            className={cn(
              "relative mt-2 text-xs text-indigo-200/80 transition-opacity duration-300 motion-reduce:transition-none",
              visible ? "opacity-100" : "opacity-0"
            )}
          >
            — {quote.attribution}
          </p>
        ) : null}
        <p className="relative mt-3 text-[10px] tabular-nums text-indigo-200/50">
          {index + 1} / {AUTH_QUOTES.length}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col justify-between", className)}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200/90">
          System Dostaw
        </p>
        <blockquote
          className={cn(
            "mt-8 text-2xl font-medium leading-snug tracking-tight text-white transition-all duration-300 ease-out motion-reduce:transition-none",
            visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          )}
        >
          „{quote.text}”
        </blockquote>
        {quote.attribution ? (
          <p
            className={cn(
              "mt-4 text-sm text-indigo-200/80 transition-opacity duration-300 motion-reduce:transition-none",
              visible ? "opacity-100" : "opacity-0"
            )}
          >
            — {quote.attribution}
          </p>
        ) : null}
      </div>
      <p className="text-xs text-indigo-200/50">
        {index + 1} / {AUTH_QUOTES.length}
      </p>
    </div>
  );
}
