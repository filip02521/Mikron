"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { useToastNotificationSound } from "@/lib/client/use-toast-notification-sound";
import { Button } from "@/components/ui/Button";
import {
  IconCircleCheck,
  IconAlertCircle,
} from "@/components/icons/StrokeIcons";
import { floatingToastBottomClass, floatingToastStackAboveClass } from "@/lib/ui/sales-mobile-chrome";
import {
  systemNoticeUndoClass,
  toastIconTileClass,
  toastIconTileSuccessClass,
  toastIconTileWarningClass,
  toastIconTileErrorClass,
  toastProgressTrackClass,
  toastProgressFillClass,
  toastProgressFillSuccessClass,
  toastProgressFillWarningClass,
  toastProgressFillErrorClass,
} from "@/lib/ui/ontime-theme";
import { NoticeContent } from "@/components/ui/NoticeContent";
import { resolveNoticeCopy } from "@/lib/ui/notice-content";

type ToastTone = "success" | "error" | "warning";

const toneIconTile: Record<ToastTone, string> = {
  success: toastIconTileSuccessClass,
  warning: toastIconTileWarningClass,
  error: toastIconTileErrorClass,
};

const toneProgressFill: Record<ToastTone, string> = {
  success: toastProgressFillSuccessClass,
  warning: toastProgressFillWarningClass,
  error: toastProgressFillErrorClass,
};

function ToneIcon({ tone }: { tone: ToastTone }) {
  if (tone === "error") return <IconAlertCircle size={18} strokeWidth={2.25} />;
  if (tone === "warning") return <IconAlertCircle size={18} strokeWidth={2.25} />;
  return <IconCircleCheck size={18} strokeWidth={2.25} />;
}

export function Toast({
  message,
  text,
  title,
  description,
  tone = "success",
  onDismiss,
  durationMs,
  action,
  stacked = false,
}: {
  /** @deprecated Preferuj {@link title} + {@link description}. */
  message?: string;
  /** Alias {@link message}. */
  text?: string;
  title?: string;
  description?: string;
  tone?: ToastTone;
  onDismiss: () => void;
  durationMs?: number;
  action?: React.ReactNode;
  stacked?: boolean;
}) {
  const copy = resolveNoticeCopy({ title, description, message: message ?? text });
  const autoMs = durationMs ?? (action ? 12_000 : 4500);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const t = setTimeout(() => onDismissRef.current(), autoMs);
    return () => clearTimeout(t);
  }, [copy.title, copy.description, autoMs]);

  useToastNotificationSound(copy.title, copy.description);

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      className={cn(
        systemNoticeUndoClass,
        "fixed z-[60] max-w-[min(100vw-1.5rem,26rem)]",
        stacked ? floatingToastStackAboveClass : floatingToastBottomClass,
        "left-4 right-4 sm:left-auto sm:right-6",
      )}
      style={{ ["--toast-duration" as string]: `${autoMs}ms` }}
    >
      <div className={toastProgressTrackClass} aria-hidden>
        <div className={cn(toastProgressFillClass, toneProgressFill[tone])} />
      </div>

      <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className={cn(toastIconTileClass, toneIconTile[tone])}>
            <ToneIcon tone={tone} />
          </span>
          <NoticeContent
            title={copy.title}
            description={copy.description}
            variant="floating"
            className="pt-0.5"
          />
        </div>

        {action ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-stretch sm:pt-0.5">
            {action}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-10 w-full text-slate-600 sm:min-w-[7.5rem]"
              onClick={onDismiss}
            >
              Zamknij
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-10 shrink-0 self-end text-slate-600 sm:self-start"
            onClick={onDismiss}
          >
            Zamknij
          </Button>
        )}
      </div>
    </div>
  );
}
