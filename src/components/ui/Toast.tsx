"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { floatingToastBottomClass } from "@/lib/ui/sales-mobile-chrome";

export function Toast({
  message,
  tone = "success",
  onDismiss,
  durationMs,
  action,
}: {
  message: string;
  tone?: "success" | "error";
  onDismiss: () => void;
  durationMs?: number;
  action?: React.ReactNode;
}) {
  const autoMs = durationMs ?? (action ? 12_000 : 4500);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const t = setTimeout(() => onDismissRef.current(), autoMs);
    return () => clearTimeout(t);
  }, [message, autoMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed z-[60] max-w-sm rounded-md border px-4 py-3 text-sm shadow-lg",
        floatingToastBottomClass,
        "left-4 right-4 sm:left-auto sm:right-6",
        tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-red-900"
      )}
    >
      <p className="font-medium">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
