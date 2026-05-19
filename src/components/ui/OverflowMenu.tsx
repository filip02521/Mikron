"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { buttonGroupItemClass } from "@/lib/ui/surfaces";

const CloseMenuContext = createContext<() => void>(() => {});

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("block h-4 w-4 shrink-0", className)}
      aria-hidden
    >
      <circle cx="12" cy="6" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="18" r="1.75" />
    </svg>
  );
}

type MenuPosition = { top: number; left: number };

export function OverflowMenu({
  label,
  align = "end",
  disabled,
  children,
  className,
  variant = "standalone",
  triggerClassName,
  iconOnly = false,
}: {
  label: string;
  align?: "start" | "end";
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  variant?: "standalone" | "segment";
  triggerClassName?: string;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const close = () => setOpen(false);

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuWidth = menuRef.current?.offsetWidth ?? 176;
    const left =
      align === "end"
        ? Math.max(8, rect.right - menuWidth)
        : Math.min(rect.left, window.innerWidth - menuWidth - 8);
    setMenuPos({
      top: rect.bottom + 4,
      left,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target) ||
        rootRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const segmentTriggerClass = cn(
    buttonGroupItemClass,
    "relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center overflow-hidden border-l border-slate-200 bg-white px-2.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
    iconOnly ? "min-w-[2.75rem]" : "gap-1.5 px-3",
    open && "bg-slate-50",
    triggerClassName
  );

  const trigger =
    variant === "segment" ? (
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        className={cn(segmentTriggerClass, className)}
      >
        <span className="inline-flex items-center justify-center leading-none">
          <MoreIcon />
        </span>
        {iconOnly ? <span className="sr-only">Więcej</span> : <span>Więcej</span>}
      </button>
    ) : (
      <Button
        ref={triggerRef}
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        className={cn(
          "min-h-[2.125rem] gap-1.5 border-slate-200 px-3 text-slate-700",
          open && "bg-slate-50",
          triggerClassName
        )}
      >
        <MoreIcon />
        <span>Więcej</span>
      </Button>
    );

  const menuPanel =
    open && menuPos ? (
      <CloseMenuContext.Provider value={close}>
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          className="fixed z-[200] min-w-[11rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          {children}
        </div>
      </CloseMenuContext.Provider>
    ) : null;

  if (variant === "segment") {
    return (
      <>
        {trigger}
        {typeof document !== "undefined" && menuPanel
          ? createPortal(menuPanel, document.body)
          : null}
      </>
    );
  }

  return (
    <>
      <div ref={rootRef} className={cn("relative", className)}>
        {trigger}
      </div>
      {typeof document !== "undefined" && menuPanel
        ? createPortal(menuPanel, document.body)
        : null}
    </>
  );
}

export function OverflowMenuItem({
  children,
  onClick,
  danger,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const close = useContext(CloseMenuContext);
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={cn(
        "block w-full cursor-pointer px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50",
        danger
          ? "text-red-700 hover:bg-red-50"
          : "text-slate-700 hover:bg-slate-50"
      )}
      onClick={() => {
        onClick();
        close();
      }}
    >
      {children}
    </button>
  );
}
