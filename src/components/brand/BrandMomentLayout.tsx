import Link from "next/link";
import { AuthBrandHeader } from "@/components/auth/AuthBrandHeader";
import { BrandCardAccent } from "@/components/brand/BrandCardAccent";
import { cn } from "@/lib/cn";
import { buttonPrimaryClass } from "@/lib/ui/ontime-theme";

/** Karta marki — 404 i komunikaty wewnątrz AppShell. */
export function BrandMomentCard({
  title,
  description,
  children,
  showLogo = true,
  className,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  showLogo?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative mx-auto w-full max-w-lg", className)}>
      {showLogo ? <AuthBrandHeader className="mb-5 sm:mb-6" /> : null}
      <div className="relative overflow-hidden rounded-lg border border-slate-200/80 bg-white/95 p-6 text-center shadow-[var(--shadow-card-elevated)] backdrop-blur-sm sm:p-8">
        <BrandCardAccent className="absolute -right-8 -top-8 h-32 w-40" />
        <div className="relative z-[1]">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
          ) : null}
          {children ? <div className="mt-6">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

/** Pełny ekran bez AppShell — gdyby kiedyś wyszedł poza shell. */
export function BrandMomentLayout({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative isolate flex min-h-dvh flex-col overflow-x-hidden bg-gradient-to-br from-indigo-50/40 via-white to-sky-50/50 px-4 py-10 sm:px-6",
        className
      )}
    >
      <div className="relative z-[1] mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <BrandMomentCard title={title} description={description} showLogo>
          {children}
        </BrandMomentCard>
      </div>
    </div>
  );
}

export function BrandMomentHomeActions() {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
      <Link
        href="/login"
        className={cn(
          buttonPrimaryClass,
          "inline-flex min-h-11 items-center justify-center px-5 py-2.5 text-sm font-medium"
        )}
      >
        Logowanie
      </Link>
      <Link
        href="/podsumowanie"
        className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
      >
        Panel zakupów
      </Link>
    </div>
  );
}
