import type { ReactNode } from "react";
import { Alert } from "@/components/ui/Alert";
import { salesPageShellClass } from "@/lib/ui/ontime-theme";

/** Wspólny układ stron podglądu handlowca (?dla=). */
export function SalesPreviewPageChrome({
  linkError,
  banner,
  children,
}: {
  linkError?: string | null;
  banner?: ReactNode;
  children: ReactNode;
}) {
  if (!linkError && !banner) {
    return children;
  }

  return (
    <div className={salesPageShellClass}>
      {banner}
      {linkError ? (
        <Alert tone="error" className="mb-4">
          {linkError}
        </Alert>
      ) : null}
      {children}
    </div>
  );
}
