import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  IconAlertCircle,
  IconCircleCheck,
  IconInfoCircle,
} from "@/components/icons/StrokeIcons";
import { Spinner } from "@/components/ui/Spinner";

export type ZkProsbaModalCalloutTone =
  | "info"
  | "sky"
  | "amber"
  | "emerald"
  | "rose"
  | "neutral"
  | "indigo";

const TONE_CLASS: Record<ZkProsbaModalCalloutTone, string> = {
  info: "border-slate-200/80 bg-slate-50/80 text-slate-700",
  sky: "border-sky-200/70 bg-sky-50/60 text-sky-900",
  amber: "border-amber-200/80 bg-amber-50/70 text-amber-950",
  emerald: "border-emerald-200/70 bg-emerald-50/50 text-emerald-900",
  rose: "border-rose-200/80 bg-rose-50/70 text-rose-800",
  neutral: "border-slate-200/80 bg-white text-slate-700",
  indigo: "border-indigo-200/70 bg-indigo-50/50 text-indigo-950",
};

const ICON_CLASS: Record<ZkProsbaModalCalloutTone, string> = {
  info: "text-slate-400",
  sky: "text-sky-600",
  amber: "text-amber-600",
  emerald: "text-emerald-600",
  rose: "text-rose-600",
  neutral: "text-slate-400",
  indigo: "text-indigo-600",
};

/** Wspólny padding/spacing calloutów w modalach ZK → prośba. */
export const ZK_PROSBA_MODAL_BODY_CLASS = "space-y-3 px-5 py-4 sm:px-6";
export const ZK_PROSBA_MODAL_CALLOUT_CLASS =
  "flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs leading-relaxed";

export function ZkProsbaModalCallout({
  tone = "info",
  icon = "auto",
  children,
  className,
  role,
}: {
  tone?: ZkProsbaModalCalloutTone;
  icon?: "auto" | "none" | "spinner" | ReactNode;
  children: ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  const resolvedRole =
    role ??
    (tone === "rose" ? "alert" : tone === "sky" && icon === "spinner" ? "status" : undefined);

  const resolvedIcon =
    icon === "none"
      ? null
      : icon === "spinner"
        ? (
            <Spinner
              size="sm"
              className={cn(
                "mt-0.5 shrink-0",
                tone === "sky" && "border-sky-200 border-t-sky-600"
              )}
            />
          )
        : icon !== "auto"
          ? icon
          : tone === "emerald"
            ? (
                <IconCircleCheck
                  size={16}
                  className={cn("mt-0.5 shrink-0", ICON_CLASS[tone])}
                />
              )
            : tone === "amber" || tone === "rose"
              ? (
                  <IconAlertCircle
                    size={16}
                    className={cn("mt-0.5 shrink-0", ICON_CLASS[tone])}
                  />
                )
              : (
                  <IconInfoCircle
                    size={16}
                    className={cn("mt-0.5 shrink-0", ICON_CLASS[tone])}
                  />
                );

  return (
    <div
      className={cn(ZK_PROSBA_MODAL_CALLOUT_CLASS, TONE_CLASS[tone], className)}
      role={resolvedRole}
      aria-live={
        resolvedRole === "alert"
          ? "assertive"
          : resolvedRole === "status"
            ? "polite"
            : undefined
      }
      aria-atomic={resolvedRole ? "true" : undefined}
    >
      {resolvedIcon}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
