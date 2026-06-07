"use client";

import { cn } from "@/lib/cn";

export type FormStatusTone = "info" | "success" | "warning" | "error";

const toneClass: Record<FormStatusTone, string> = {
  info: "border-indigo-200 bg-indigo-50/80 text-indigo-950",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  error: "border-red-200 bg-red-50 text-red-950",
};

/** Jednolity komunikat w panelu statusu formularza (weryfikacja, prośba). */
export function FormStatusAlert({
  tone,
  title,
  children,
  className,
}: {
  tone: FormStatusTone;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-xs leading-relaxed",
        toneClass[tone],
        className
      )}
    >
      {title ? <p className="font-semibold leading-snug">{title}</p> : null}
      <div className={cn(title ? "mt-0.5" : undefined, "text-xs leading-relaxed opacity-95")}>
        {children}
      </div>
    </div>
  );
}
