import {
  ONTIME_AUTH_FOOTER,
  ONTIME_TAGLINE_SHORT,
} from "@/lib/ui/ontime-brand";
import { panelContentFooterClass, panelTypography, salesChromeInsetClass } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";

/** Jedna linia marki — do złożonych stopek (panel dzienny). */
export function AppBrandFooterLine({ className }: { className?: string }) {
  return (
    <p className={cn(panelTypography.caption, "text-center", className)}>
      <span className="font-medium text-slate-600">{ONTIME_AUTH_FOOTER}</span>
      <span className="text-slate-400"> · </span>
      <span className="text-slate-500">{ONTIME_TAGLINE_SHORT}</span>
    </p>
  );
}

/** Lekka stopka tylko z marką. */
export function AppBrandContentFooter({
  className,
  mobileOnly = false,
  variant = "card",
}: {
  className?: string;
  /** Ukryj na lg+ — sidebar ma markę. */
  mobileOnly?: boolean;
  /** W karcie (border-top) vs. na końcu strony (bez tła). */
  variant?: "card" | "page";
}) {
  return (
    <footer
      className={cn(
        variant === "card"
          ? panelContentFooterClass
          : cn(salesChromeInsetClass, "py-4"),
        mobileOnly && "lg:hidden",
        className
      )}
      aria-label="Stopka OnTime"
    >
      <AppBrandFooterLine />
    </footer>
  );
}
