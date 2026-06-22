"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { modalBackdropClass } from "@/lib/ui/surfaces";
import { Button } from "@/components/ui/Button";
import { SCROLL_LOCK_ALLOW_ATTR, useBodyScrollLock } from "@/lib/ui/page-scroll-lock";

export function SupplierEditSheet({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  pending,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  pending?: boolean;
}) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, pending]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className={cn(modalBackdropClass, "z-[58]")}
        aria-label="Zamknij edycję"
        onClick={pending ? undefined : onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-edit-sheet-title"
      >
        <header className="shrink-0 border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="supplier-edit-sheet-title"
                className="truncate text-lg font-semibold text-slate-900"
              >
                {title}
              </h2>
              {description ? (
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              disabled={pending}
              onClick={onClose}
            >
              Zamknij
            </Button>
          </div>
        </header>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
          {...{ [SCROLL_LOCK_ALLOW_ATTR]: "" }}
        >
          {children}
        </div>

        <footer className="shrink-0 border-t border-slate-100 bg-slate-50/80 px-5 py-4">
          <div className="flex flex-wrap gap-2">{footer}</div>
        </footer>
      </aside>
    </>
  );
}
