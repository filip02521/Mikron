"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { cn } from "@/lib/cn";

const GAP = 6;

/** :focus-visible = fokus z klawiatury; przeglądarka bez tego selektora — traktujemy jak klawiaturę. */
function isKeyboardFocus(el: HTMLElement): boolean {
  try {
    return el.matches(":focus-visible");
  } catch {
    return true;
  }
}

/**
 * Dymek z dowolną treścią (wykres, liczby) zamiast natywnego `title`:
 * hover, fokus z klawiatury albo klik/dotyk (przypina), Esc zamyka. Portal — bez ucinania przez overflow tabeli.
 */
export function HoverCard({
  children,
  content,
  ariaLabel,
  triggerClassName,
  panelClassName,
  width = 280,
  estimatedHeight = 88,
  stopPropagation = true,
  dataAttr,
}: {
  /** Zawartość przycisku-wyzwalacza. */
  children: ReactNode;
  content: ReactNode;
  ariaLabel: string;
  triggerClassName?: string;
  panelClassName?: string;
  width?: number;
  /** Do wyboru strony (pod / nad wyzwalaczem). */
  estimatedHeight?: number;
  /** Klik nie przechodzi do wiersza tabeli (zaznaczenie, otwarcie karty). */
  stopPropagation?: boolean;
  dataAttr?: string;
}) {
  const panelId = useId();
  const mounted = useClientHydrated();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = buttonRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const w = Math.min(width, window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - w - 8);
    const below = rect.bottom + GAP + estimatedHeight < window.innerHeight;
    setPos({ top: below ? rect.bottom + GAP : rect.top - GAP, left, above: !below });
  }, [width, estimatedHeight]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!pinned) return;
    const onPointerDown = (event: PointerEvent) => {
      if (buttonRef.current?.contains(event.target as Node)) return;
      setPinned(false);
      setHovered(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [pinned]);

  const show = open && pos != null && mounted;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-describedby={show ? panelId : undefined}
        {...(dataAttr ? { [dataAttr]: "" } : {})}
        onPointerDown={(event) => {
          if (stopPropagation) event.stopPropagation();
        }}
        onClick={(event) => {
          if (stopPropagation) event.stopPropagation();
          event.preventDefault();
          setPinned((value) => {
            const next = !value;
            if (next) updatePosition();
            return next;
          });
        }}
        onMouseEnter={() => {
          updatePosition();
          setHovered(true);
        }}
        onMouseLeave={() => setHovered(false)}
        onFocus={(event) => {
          // Tylko fokus z klawiatury (Tab). Fokus programowy (np. okno skupia pierwszy element) nie otwiera dymka.
          if (!isKeyboardFocus(event.currentTarget)) return;
          updatePosition();
          setHovered(true);
        }}
        onBlur={() => setHovered(false)}
        onKeyDown={(event) => {
          // Dymek z hover/fokusu musi dać się zamknąć bez ruszania kursorem.
          if (event.key !== "Escape" || !open) return;
          event.stopPropagation();
          setPinned(false);
          setHovered(false);
        }}
        className={triggerClassName}
      >
        {children}
      </button>
      {show
        ? createPortal(
            <span
              id={panelId}
              role="tooltip"
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                width: Math.min(width, window.innerWidth - 16),
                zIndex: 80,
                transform: pos.above ? "translateY(-100%)" : undefined,
              }}
              className={cn(
                "pointer-events-none block rounded-md border px-2.5 py-2 text-xs leading-relaxed shadow-[var(--shadow-elevated)]",
                panelClassName ?? "border-slate-200/90 bg-white text-slate-800"
              )}
            >
              {content}
            </span>,
            document.body
          )
        : null}
    </>
  );
}
