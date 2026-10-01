"use client";

import { useEffect, useRef, useState } from "react";
import { IconCircleCheck } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useToastNotificationSound } from "@/lib/client/use-toast-notification-sound";
import { NoticeContent } from "@/components/ui/NoticeContent";
import { resolveNoticeCopy } from "@/lib/ui/notice-content";
import { UNDO_WINDOW_MS, undoWindowBannerDescription } from "@/lib/orders/daily-panel-undo";
import { floatingToastBottomClass } from "@/lib/ui/sales-mobile-chrome";
import {
  systemNoticeUndoClass,
  undoNoticeIconTileClass,
  undoNoticeProgressFillClass,
  undoNoticeProgressTrackClass,
} from "@/lib/ui/ontime-theme";

export type UndoToastPlacement = "inline" | "floating";

export function UndoToast({
  message,
  title,
  description,
  detailLines,
  tone = "success",
  onDismiss,
  onUndo,
  undoLabel = "Cofnij",
  undoShortcut,
  durationMs = UNDO_WINDOW_MS,
  expiresAt,
  paused = false,
  placement = "floating",
  className,
}: {
  /** @deprecated Użyj {@link title} + {@link description}. */
  message?: string;
  title?: string;
  description?: string;
  detailLines?: string[];
  tone?: "success" | "error";
  onDismiss: () => void;
  onUndo?: () => void;
  undoLabel?: string;
  undoShortcut?: string;
  durationMs?: number;
  /** Koniec okna cofania (ms) — timer i pasek od tego momentu, nie od mount. */
  expiresAt?: number;
  /**
   * Wstrzymaj odliczanie (np. gdy nad toastem jest modal).
   * Po wznowieniu kontynuuje pozostały czas.
   */
  paused?: boolean;
  /** Inline — w treści panelu; floating — nad dolną nawigacją. */
  placement?: UndoToastPlacement;
  className?: string;
}) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const copy = resolveNoticeCopy({ title, description, message });
  const resolvedTitle = copy.title || "Zapisano zmianę";
  const resolvedDescription =
    copy.description ??
    (message && title
      ? undefined
      : message && !title && message.includes("cofn")
        ? undefined
        : !copy.description && !title && !message
          ? undoWindowBannerDescription()
          : undefined);

  useToastNotificationSound(resolvedTitle, resolvedDescription);

  const remainingMsRef = useRef<number | null>(null);
  const [animationMs, setAnimationMs] = useState(() =>
    expiresAt != null ? Math.max(0, expiresAt - Date.now()) : durationMs
  );
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (remainingMsRef.current == null) {
      remainingMsRef.current =
        expiresAt != null ? Math.max(0, expiresAt - Date.now()) : durationMs;
    }

    if (paused) return;

    const remaining = remainingMsRef.current;
    if (remaining <= 0) {
      onDismissRef.current();
      return;
    }

    setAnimationMs(remaining);
    setAnimKey((k) => k + 1);
    const startedAt = Date.now();
    const timeout = window.setTimeout(() => onDismissRef.current(), remaining);
    return () => {
      window.clearTimeout(timeout);
      const elapsed = Date.now() - startedAt;
      remainingMsRef.current = Math.max(
        0,
        (remainingMsRef.current ?? 0) - elapsed
      );
    };
  }, [paused, durationMs, expiresAt]);

  const isError = tone === "error";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-hidden={paused || undefined}
      className={cn(
        systemNoticeUndoClass,
        placement === "inline"
          ? "mb-4 w-full"
          : cn(
              "fixed z-[65] max-w-[min(100vw-1.5rem,26rem)]",
              floatingToastBottomClass,
              "left-4 right-4 sm:left-auto sm:right-6"
            ),
        isError && "border-red-200/90",
        className
      )}
      style={{ ["--undo-duration" as string]: `${animationMs}ms` }}
    >
      <div className={undoNoticeProgressTrackClass} aria-hidden>
        <div
          key={animKey}
          className={cn(undoNoticeProgressFillClass, isError && "bg-red-500")}
          style={paused ? { animationPlayState: "paused" } : undefined}
        />
      </div>

      <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className={cn(undoNoticeIconTileClass, isError && "from-red-600 to-red-700 ring-red-500/30")}>
            <IconCircleCheck size={18} strokeWidth={2.25} />
          </span>
          <div className="min-w-0 pt-0.5">
            <NoticeContent
              title={resolvedTitle}
              description={resolvedDescription}
              variant="floating"
            />
            {detailLines?.length ? (
              <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-600">
                {detailLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            ) : null}
            {undoShortcut ? (
              <p className="mt-1 text-[11px] text-slate-500">
                <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[10px] text-slate-700">
                  {undoShortcut}
                </kbd>{" "}
                — szybkie cofnięcie
              </p>
            ) : null}
          </div>
        </div>

        {onUndo ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-stretch sm:pt-0.5">
            <Button
              type="button"
              size="sm"
              className="min-h-10 w-full sm:min-w-[7.5rem]"
              onClick={onUndo}
              disabled={paused}
            >
              {undoLabel}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-10 w-full text-slate-600 sm:min-w-[7.5rem]"
              onClick={onDismiss}
              disabled={paused}
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
            disabled={paused}
          >
            Zamknij
          </Button>
        )}
      </div>
    </div>
  );
}
