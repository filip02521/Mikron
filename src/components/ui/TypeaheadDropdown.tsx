"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { SCROLL_LOCK_ALLOW_ATTR } from "@/lib/ui/page-scroll-lock";

export const TYPEAHEAD_KEYBOARD_HINT = "↑↓ wybierz · Enter zatwierdź · Esc zamknij listę";

type TypeaheadDropdownPosition = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
};

const TYPEAHEAD_PORTAL_GAP = 4;

function typeaheadMaxHeightPx(size: NonNullable<TypeaheadDropdownProps["size"]>): number {
  if (typeof window === "undefined") {
    return size === "comfortable" ? 352 : 288;
  }
  const dvhCap = window.innerHeight * (size === "comfortable" ? 0.52 : 0.45);
  const remCap = (size === "comfortable" ? 22 : 18) * 16;
  return Math.min(remCap, dvhCap, size === "comfortable" ? 352 : 288);
}

type TypeaheadDropdownProps = {
  open: boolean;
  children: React.ReactNode;
  className?: string;
  emptyMessage?: string;
  listboxId?: string;
  footer?: React.ReactNode;
  /** comfortable — wyższa lista w modalach i formularzach z wieloma wynikami */
  size?: "default" | "comfortable";
  /** Portal do body — omija overflow w modalach i sekcjach z overflow-hidden. */
  portalled?: boolean;
  anchorRef?: RefObject<HTMLElement | null>;
};

function typeaheadPanelClassName(
  size: NonNullable<TypeaheadDropdownProps["size"]>,
  className: string | undefined,
  portalled: boolean
) {
  return cn(
    portalled
      ? "z-[90] overflow-auto rounded-lg border border-indigo-200/80 bg-white py-1 shadow-xl shadow-indigo-900/10 ring-1 ring-indigo-100"
      : "absolute left-0 right-0 top-full z-[80] mt-1 w-full overflow-auto rounded-lg border border-indigo-200/80 bg-white py-1 shadow-xl shadow-indigo-900/10 ring-1 ring-indigo-100",
    size === "comfortable"
      ? "max-h-[min(22rem,52dvh)]"
      : "max-h-[min(18rem,45dvh)] sm:max-h-72",
    className
  );
}

function TypeaheadDropdownPanel({
  listboxId,
  className,
  size,
  emptyMessage,
  footer,
  children,
  portalled,
  portalPosition,
}: {
  listboxId?: string;
  className?: string;
  size: NonNullable<TypeaheadDropdownProps["size"]>;
  emptyMessage?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  portalled: boolean;
  portalPosition?: TypeaheadDropdownPosition | null;
}) {
  return (
    <ul
      id={listboxId}
      role="listbox"
      {...{ [SCROLL_LOCK_ALLOW_ATTR]: "" }}
      style={
        portalled && portalPosition
          ? {
              position: "fixed",
              top: portalPosition.top,
              bottom: portalPosition.bottom,
              left: portalPosition.left,
              width: portalPosition.width,
              maxHeight: portalPosition.maxHeight,
            }
          : undefined
      }
      className={typeaheadPanelClassName(size, className, portalled)}
    >
      {children}
      {emptyMessage ? (
        <li className="px-3 py-2.5 text-sm text-slate-600">{emptyMessage}</li>
      ) : null}
      {footer ? (
        <li className="sticky bottom-0 border-t border-slate-100 bg-slate-50/95 px-3 py-1.5 text-[10px] leading-snug text-slate-500">
          {footer}
        </li>
      ) : null}
    </ul>
  );
}

function PortalledTypeaheadDropdown({
  anchorRef,
  size = "default",
  ...panelProps
}: Omit<TypeaheadDropdownProps, "open" | "portalled" | "anchorRef"> & {
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const [portalPosition, setPortalPosition] = useState<TypeaheadDropdownPosition | null>(null);
  const lastPositionRef = useRef<TypeaheadDropdownPosition | null>(null);

  const updatePortalPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const maxHeight = typeaheadMaxHeightPx(size);
    const spaceBelow = window.innerHeight - rect.bottom - TYPEAHEAD_PORTAL_GAP;
    const spaceAbove = rect.top - TYPEAHEAD_PORTAL_GAP;
    const openAbove = spaceBelow < Math.min(maxHeight, 120) && spaceAbove > spaceBelow;

    const next: TypeaheadDropdownPosition = {
      top: openAbove ? undefined : rect.bottom + TYPEAHEAD_PORTAL_GAP,
      bottom: openAbove ? window.innerHeight - rect.top + TYPEAHEAD_PORTAL_GAP : undefined,
      left: rect.left,
      width: rect.width,
      maxHeight,
    };

    const prev = lastPositionRef.current;
    if (
      prev &&
      prev.top === next.top &&
      prev.bottom === next.bottom &&
      prev.left === next.left &&
      prev.width === next.width &&
      prev.maxHeight === next.maxHeight
    ) {
      return;
    }
    lastPositionRef.current = next;
    setPortalPosition(next);
  }, [anchorRef, size]);

  useLayoutEffect(() => {
    updatePortalPosition();
    const raf = requestAnimationFrame(updatePortalPosition);
    window.addEventListener("resize", updatePortalPosition);
    window.addEventListener("scroll", updatePortalPosition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePortalPosition);
      window.removeEventListener("scroll", updatePortalPosition, true);
    };
  }, [updatePortalPosition]);

  if (!portalPosition) return null;

  if (typeof document === "undefined") {
    return (
      <TypeaheadDropdownPanel
        {...panelProps}
        portalled
        portalPosition={portalPosition}
        size={size}
      />
    );
  }

  return createPortal(
    <TypeaheadDropdownPanel
      {...panelProps}
      portalled
      portalPosition={portalPosition}
      size={size}
    />,
    document.body
  );
}

export function TypeaheadDropdown({
  open,
  children,
  className,
  emptyMessage,
  listboxId,
  footer,
  size = "default",
  portalled = false,
  anchorRef,
}: TypeaheadDropdownProps) {
  if (!open) return null;

  if (portalled && anchorRef) {
    return (
      <PortalledTypeaheadDropdown
        anchorRef={anchorRef}
        listboxId={listboxId}
        className={className}
        size={size}
        emptyMessage={emptyMessage}
        footer={footer}
      >
        {children}
      </PortalledTypeaheadDropdown>
    );
  }

  return (
    <TypeaheadDropdownPanel
      listboxId={listboxId}
      className={className}
      size={size}
      emptyMessage={emptyMessage}
      footer={footer}
      portalled={false}
    >
      {children}
    </TypeaheadDropdownPanel>
  );
}

export function TypeaheadSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <li className="px-3 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-wider text-indigo-600/80">
      {children}
    </li>
  );
}

/** Wiersz informacyjny (np. kontrahent Subiekt bez mapowania w aplikacji). */
export function TypeaheadInfoRow({
  title,
  subtitle,
  size = "default",
}: {
  title: string;
  subtitle?: string;
  size?: "default" | "comfortable";
}) {
  return (
    <li
      role="presentation"
      className={cn(
        "text-left text-sm text-slate-600",
        size === "comfortable" ? "px-3.5 py-3" : "px-3 py-2.5"
      )}
    >
      <span className="font-medium text-slate-800">{title}</span>
      {subtitle ? <span className="mt-0.5 block text-xs text-slate-500">{subtitle}</span> : null}
    </li>
  );
}

export function TypeaheadOption({
  onSelect,
  onHighlight,
  title,
  subtitle,
  badge,
  highlighted = false,
  optionId,
  size = "default",
}: {
  onSelect: () => void;
  onHighlight?: () => void;
  title: string;
  subtitle?: string;
  badge?: string;
  highlighted?: boolean;
  optionId?: string;
  size?: "default" | "comfortable";
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (highlighted) {
      ref.current?.scrollIntoView({ block: "nearest" });
    }
  }, [highlighted]);

  return (
    <li role="presentation">
      <button
        id={optionId}
        ref={ref}
        type="button"
        role="option"
        aria-selected={highlighted}
        className={cn(
          "flex w-full cursor-pointer flex-col gap-0.5 text-left text-sm transition-colors",
          size === "comfortable" ? "px-3.5 py-3" : "px-3 py-2.5",
          highlighted
            ? "bg-indigo-100 text-indigo-950 ring-1 ring-inset ring-indigo-200"
            : "text-slate-900 hover:bg-indigo-50/80 focus:bg-indigo-50/80 focus:outline-none"
        )}
        onMouseDown={(e) => e.preventDefault()}
        onMouseEnter={onHighlight}
        onClick={onSelect}
      >
        <span className="flex items-start justify-between gap-2">
          <span className="font-medium">{title}</span>
          {badge ? (
            <span className="shrink-0 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800">
              {badge}
            </span>
          ) : null}
        </span>
        {subtitle ? <span className="text-xs text-slate-600">{subtitle}</span> : null}
      </button>
    </li>
  );
}
