"use client";

import { useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useZdEstimateNoticeTray } from "@/components/zakupy/ZdEstimateNoticeTray";
import { cn } from "@/lib/cn";
import type { NoticeTone } from "@/lib/ui/notice-content";
import {
  IconAlertCircle,
  IconChevronDown,
  IconCircleCheck,
  IconInfoCircle,
  IconX,
} from "@/components/icons/StrokeIcons";

const TONE: Record<NoticeTone, { shell: string; icon: string; bar: string }> = {
  info: { shell: "border-indigo-200 bg-indigo-50/80 text-indigo-950", icon: "text-indigo-600", bar: "bg-indigo-500" },
  success: { shell: "border-emerald-200 bg-emerald-50/80 text-emerald-950", icon: "text-emerald-600", bar: "bg-emerald-500" },
  warning: { shell: "border-amber-200 bg-amber-50/80 text-amber-950", icon: "text-amber-600", bar: "bg-amber-400" },
  error: { shell: "border-red-200 bg-red-50/80 text-red-950", icon: "text-red-600", bar: "bg-red-500" },
};

function ToneIcon({ tone, className }: { tone: NoticeTone; className?: string }) {
  if (tone === "success") return <IconCircleCheck size={15} className={className} />;
  if (tone === "info") return <IconInfoCircle size={15} className={className} />;
  return <IconAlertCircle size={15} className={className} />;
}

/**
 * Komunikat kreatora ZD w wersji kompaktowej — jedna linia (tytuł), szczegóły
 * i akcje po rozwinięciu, ostrzeżenia da się zamknąć. Nie zjada pola roboczego
 * tabeli tak jak pełny {@link Alert}.
 *
 * - `error` — domyślnie rozwinięty, bez zamykania (blokada musi być widoczna).
 * - `warning` / `info` — domyślnie zwinięty, z „×”. Zamknięcie trwa, dopóki
 *   komunikat nie zniknie i nie pojawi się ponownie (remount).
 * - `tray` — komunikat idzie do paska „Uwagi” ({@link ZdEstimateNoticeTrayBar}) zamiast
 *   stać nad tabelą; w panelu jest rozwinięty. Bez paska zostaje w miejscu.
 */
export function ZdEstimateNotice({
  tone = "info",
  title,
  children,
  defaultExpanded,
  dismissible,
  tray = false,
  className,
}: {
  tone?: NoticeTone;
  title?: string;
  children?: ReactNode;
  defaultExpanded?: boolean;
  dismissible?: boolean;
  /** Do paska „Uwagi” zamiast nad tabelę (gdy pasek jest na ekranie). */
  tray?: boolean;
  className?: string;
}) {
  const id = useId();
  const [dismissed, setDismissed] = useState(false);
  const heading = title ?? (typeof children === "string" ? children : "Uwaga");
  const { inTray, panel } = useZdEstimateNoticeTray(tray && !dismissed, id, tone, heading);
  const canDismiss = dismissible ?? tone !== "error";
  const [expanded, setExpanded] = useState(defaultExpanded ?? (tone === "error" || inTray));
  if (dismissed) return null;

  const hasBody = children != null && children !== false && children !== "";
  // Bez tytułu: tekst idzie do nagłówka, inna treść zawsze widoczna pod nim.
  const showBody = hasBody && (title ? expanded : typeof children !== "string");
  const t = TONE[tone];

  const notice = (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("relative overflow-hidden rounded-md border text-sm", t.shell, className)}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", t.bar)} aria-hidden />
      <div className="flex items-center gap-2 py-1.5 pl-3.5 pr-1.5">
        <ToneIcon tone={tone} className={cn("shrink-0", t.icon)} />
        {hasBody && title ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left font-semibold"
          >
            <span className="truncate">{heading}</span>
            <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-xs font-medium opacity-70">
              {expanded ? "Zwiń" : "Szczegóły"}
              <IconChevronDown
                size={13}
                className={cn("transition-transform", expanded && "rotate-180")}
              />
            </span>
          </button>
        ) : (
          <p className="min-w-0 flex-1 truncate font-semibold">{heading}</p>
        )}
        {canDismiss ? (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label={`Zamknij komunikat: ${heading}`}
            title="Zamknij"
            className="shrink-0 rounded p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100"
          >
            <IconX size={14} />
          </button>
        ) : null}
      </div>
      {showBody ? (
        <div className="border-t border-black/5 py-2 pl-3.5 pr-3 text-sm leading-relaxed opacity-95">
          {children}
        </div>
      ) : null}
    </div>
  );
  return inTray && panel ? createPortal(notice, panel) : notice;
}
