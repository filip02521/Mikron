"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { modalBackdropClass, modalPanelClass } from "@/lib/ui/surfaces";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";

export type ModalTier = "standard" | "raised" | "top";
export type ModalSize = "sm" | "md" | "lg" | "xl";

const tierZ: Record<ModalTier, { backdrop: string; panel: string }> = {
  standard: { backdrop: "z-50", panel: "z-[55]" },
  raised: { backdrop: "z-[60]", panel: "z-[61]" },
  top: { backdrop: "z-[70]", panel: "z-[71]" },
};

const sizeClass: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "w-[min(100%-1.5rem,72rem)] max-w-5xl",
};

export function ModalShell({
  open,
  onClose,
  title,
  description,
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
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
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
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !disableBackdropClose) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, disableBackdropClose]);

  if (!open) return null;

  const z = tierZ[tier];
  const hasHeader = Boolean(title || description);

  return (
    <>
      <button
        type="button"
        className={cn(modalBackdropClass, z.backdrop)}
        aria-label="Zamknij"
        onClick={disableBackdropClose ? undefined : onClose}
      />
      <div
        role={role}
        aria-modal="true"
        aria-labelledby={hasHeader ? titleId : undefined}
        aria-describedby={describedById}
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
              <h2 id={titleId} className="text-lg font-semibold text-slate-900">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className={cn("text-sm leading-relaxed text-slate-500", title && "mt-1")}>
                {description}
              </p>
            ) : null}
          </header>
        ) : null}
        <div className={cn("relative min-h-0 flex-1 overflow-y-auto", bodyClassName)}>
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
}
