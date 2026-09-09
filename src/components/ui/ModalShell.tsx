"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { modalBackdropClass, modalPanelClass } from "@/lib/ui/surfaces";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { HelpHintBubble } from "@/components/ui/HelpHintBubble";
import { SCROLL_LOCK_ALLOW_ATTR, useBodyScrollLock } from "@/lib/ui/page-scroll-lock";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type ModalTier = "standard" | "raised" | "top" | "stack" | "overlay";
export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

const tierZ: Record<ModalTier, { backdrop: string; panel: string }> = {
  standard: { backdrop: "z-50", panel: "z-[55]" },
  raised: { backdrop: "z-[60]", panel: "z-[61]" },
  top: { backdrop: "z-[70]", panel: "z-[71]" },
  /** Potwierdzenia nad innymi modalami (np. stock check w formularzu prośby). */
  stack: { backdrop: "z-[80]", panel: "z-[81]" },
  /** Wizard / overlay nad modem stack (np. TeethOcrWizard nad TeethOrderBuilderModal). */
  overlay: { backdrop: "z-[90]", panel: "z-[91]" },
};

const sizeClass: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "w-[min(100%-1.5rem,72rem)] max-w-5xl",
  full: "w-[min(100%-1rem,88rem)] max-w-none",
};

export function ModalShell({
  open,
  onClose,
  title,
  description,
  titleHint,
  titleHintAriaLabel = "O tym oknie",
  titleId = "modal-title",
  describedById,
  children,
  footer,
  size = "md",
  tier = "standard",
  role = "dialog",
  className,
  bodyClassName,
  loadingMessage,
  disableBackdropClose = false,
  bodyScroll = true,
  ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  /** Podpowiedź przy tytule zamiast osobnego opisu. */
  titleHint?: string;
  titleHintAriaLabel?: string;
  titleId?: string;
  describedById?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  tier?: ModalTier;
  role?: "dialog" | "alertdialog";
  className?: string;
  bodyClassName?: string;
  loadingMessage?: string | null;
  disableBackdropClose?: boolean;
  /** Domyślnie treść modala przewija się wewnątrz panelu; wyłącz dla krótkich formularzy bez wewnętrznego scrolla. */
  bodyScroll?: boolean;
  /** Nazwa dialogu, gdy nie ma widocznego `title` (np. scena loadingu). */
  ariaLabel?: string;
}) {
  useBodyScrollLock(open);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const focusFirst = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusable) {
      focusable.focus();
    } else {
      panel.focus();
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    // Skup pierwszy focusable w modalu (rAF czeka na mount dzieci).
    const raf = requestAnimationFrame(focusFirst);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !disableBackdropClose) {
        onClose();
        return;
      }
      // Focus trap — Tab/Shift+Tab zostaje w modalu.
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !panel.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      // Przywróć fokus do elementu, który otworzył modal.
      const prev = previouslyFocusedRef.current;
      if (prev && typeof prev.focus === "function") {
        prev.focus();
      }
      previouslyFocusedRef.current = null;
    };
  }, [open, onClose, disableBackdropClose, focusFirst]);

  if (!open) return null;

  const z = tierZ[tier];
  const hasHeader = Boolean(title || description || titleHint);

  const shell = (
    <>
      {disableBackdropClose ? (
        <div className={cn(modalBackdropClass, z.backdrop)} aria-hidden />
      ) : (
        <button
          type="button"
          className={cn(modalBackdropClass, z.backdrop)}
          aria-label="Zamknij"
          onClick={onClose}
        />
      )}
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={hasHeader ? titleId : undefined}
        aria-label={!hasHeader ? ariaLabel : undefined}
        aria-describedby={describedById}
        tabIndex={-1}
        className={cn(
          modalPanelClass,
          "fixed left-1/2 top-1/2 max-h-[min(calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem),880px)] w-[min(100%-1rem,100%)] -translate-x-1/2 -translate-y-1/2 sm:w-full",
          sizeClass[size],
          z.panel,
          className
        )}
      >
        {loadingMessage ? (
          <ActionLoadingOverlay variant="modal" message={loadingMessage} />
        ) : null}
        {hasHeader ? (
          <header className="shrink-0 border-b border-slate-100 px-5 py-4 sm:px-6">
            {title ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 id={titleId} className="text-lg font-semibold text-slate-900">
                  {title}
                </h2>
                {titleHint ? (
                  <HelpHintBubble
                    message={titleHint}
                    tone="slate"
                    size="md"
                    ariaLabel={titleHintAriaLabel}
                  />
                ) : null}
              </div>
            ) : null}
            {description ? (
              <p className={cn("text-sm leading-relaxed text-slate-500", title && "mt-1")}>
                {description}
              </p>
            ) : null}
          </header>
        ) : null}
        <div
          className={cn(
            bodyScroll ? "relative min-h-0 flex-1 overflow-y-auto" : "relative shrink-0 overflow-visible",
            bodyClassName,
          )}
          {...{ [SCROLL_LOCK_ALLOW_ATTR]: "" }}
        >
          {children}
        </div>
        {footer ? (
          <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4 sm:px-6">
            {footer}
          </footer>
        ) : null}
      </div>
    </>
  );

  if (typeof document === "undefined") return shell;
  return createPortal(shell, document.body);
}
