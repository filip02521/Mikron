"use client";

import { useEffect, useState } from "react";
import { AUTH_QUOTES, type AuthQuote } from "@/lib/auth-quotes";
import { AuthCompactQuoteBackdrop } from "@/components/auth/AuthBackgroundArt";
import { isAuthVisualVariant } from "@/components/auth/auth-visual-variant";
import {
  ONTIME_APP_NAME,
  ONTIME_COMPANY,
  ONTIME_TAGLINE,
} from "@/lib/ui/ontime-brand";
import { cn } from "@/lib/cn";

const ROTATE_MS = 9000;
const FADE_MS = 320;

type QuoteAnimClass = "auth-quote-enter" | "auth-quote-exit";

function QuoteText({
  quote,
  animClass,
  compact,
}: {
  quote: AuthQuote;
  animClass: QuoteAnimClass;
  compact: boolean;
}) {
  return (
    <>
      <blockquote
        key={`${quote.text}-${animClass}`}
        className={cn(
          compact
            ? "relative mt-2.5 text-sm font-medium leading-snug tracking-tight text-white sm:mt-3 sm:text-base"
            : "mt-10 text-2xl font-medium leading-snug tracking-tight text-white xl:mt-12",
          animClass
        )}
      >
        „{quote.text}&quot;
      </blockquote>
      {quote.attribution ? (
        <p
          key={`${quote.attribution}-${animClass}`}
          className={cn(
            compact
              ? "relative mt-2 text-xs text-indigo-200/80"
              : "mt-4 text-sm text-indigo-200/80",
            animClass
          )}
        >
          — {quote.attribution}
        </p>
      ) : null}
    </>
  );
}

export function AuthQuotePanel({
  className,
  compact = false,
}: {
  className?: string;
  /** Kompaktowa wersja na telefon — gradient jak panel boczny na desktopie. */
  compact?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [animClass, setAnimClass] = useState<QuoteAnimClass>("auth-quote-enter");

  useEffect(() => {
    const rotateId = window.setInterval(() => {
      setAnimClass("auth-quote-exit");
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % AUTH_QUOTES.length);
        setAnimClass("auth-quote-enter");
      }, FADE_MS);
    }, ROTATE_MS);

    return () => window.clearInterval(rotateId);
  }, []);

  const quote: AuthQuote = AUTH_QUOTES[index]!;

  if (compact) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-lg bg-gradient-to-br from-indigo-700 via-sky-800 to-slate-900 px-4 py-4 shadow-lg shadow-indigo-900/20",
          className
        )}
      >
        {!isAuthVisualVariant("minimal") ? <AuthCompactQuoteBackdrop /> : null}
        {!isAuthVisualVariant("minimal") ? (
          <div
            className="pointer-events-none absolute -right-8 top-0 h-24 w-24 rounded-full bg-indigo-400/20 blur-2xl"
            aria-hidden
          />
        ) : null}
        <p className="relative text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-200/80">
          {ONTIME_COMPANY} · {ONTIME_APP_NAME}
        </p>
        <p className="relative mt-0.5 text-xs font-medium text-sky-100/95">{ONTIME_TAGLINE}</p>
        <QuoteText quote={quote} animClass={animClass} compact />
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
          {ONTIME_COMPANY}
        </p>
        <p
          className="mt-2 text-4xl font-semibold tracking-tight text-white xl:text-[2.75rem]"
          aria-label={ONTIME_APP_NAME}
        >
          <span>On</span>
          <span className="text-sky-200">Time</span>
        </p>
        <p className="mt-2 text-sm font-medium text-sky-100/95">{ONTIME_TAGLINE}</p>
        <QuoteText quote={quote} animClass={animClass} compact={false} />
      </div>
      <p className="text-xs text-indigo-200/50">
        {index + 1} / {AUTH_QUOTES.length}
      </p>
    </div>
  );
}
