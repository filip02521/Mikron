"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { IconChevronDown } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { computeAnchoredDropdownPosition } from "@/lib/ui/dropdown-anchor";
import { panelDropdownShellClass, panelMenuItemClass, panelSegmentControlClass, panelSegmentControlOpenClass } from "@/lib/ui/ontime-theme";

function useMenuAnchor(manualOpen: boolean) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const update = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panel = panelRef.current;
    const measured = panel?.scrollHeight ?? panel?.offsetHeight;
    const fallback = manualOpen ? 148 : 300;
    const menuHeight = measured && measured > 0 ? measured : fallback;
    setPos(computeAnchoredDropdownPosition(r, menuHeight));
  }, [manualOpen]);

  return { anchorRef, panelRef, pos, update, clear: () => setPos(null) };
}

export function ShiftMenu({
  disabled,
  onShiftWeeks,
  onShiftDate,
  grouped = false,
  compact = false,
  className,
}: {
  disabled?: boolean;
  onShiftWeeks: (weeks: number) => void;
  onShiftDate: (isoDate: string) => void;
  grouped?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [dateValue, setDateValue] = useState("");
  const panelId = useId();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const { anchorRef, panelRef, pos, update, clear } = useMenuAnchor(manualOpen);

  const close = useCallback(() => {
    setOpen(false);
    setManualOpen(false);
    setDateValue("");
    clear();
  }, [clear]);

  useLayoutEffect(() => {
    if (!open) return;
    if (panelRef.current) panelRef.current.scrollTop = 0;
    update();
    const raf = requestAnimationFrame(() => {
      if (panelRef.current) panelRef.current.scrollTop = 0;
      update();
    });
    const onScroll = () => update();
    const onResize = () => update();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, manualOpen, update]);

  useLayoutEffect(() => {
    if (!open || !manualOpen) return;
    const input = dateInputRef.current;
    if (!input) return;
    input.focus();
    try {
      input.showPicker();
    } catch {
      /* showPicker wymaga gestu użytkownika w części przeglądarek */
    }
  }, [open, manualOpen]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, close, anchorRef, panelRef]);

  const pickWeeks = (w: number) => {
    onShiftWeeks(w);
    close();
  };

  const openManualDate = useCallback(() => {
    setManualOpen(true);
  }, []);

  const applyDate = () => {
    if (!dateValue) return;
    onShiftDate(dateValue);
    close();
  };

  const menuPanel =
    open && pos && typeof document !== "undefined" ? (
      <div
        ref={panelRef}
        id={panelId}
        role="menu"
        className={cn(
          "fixed z-[100] min-w-[168px] py-1",
          manualOpen ? "overflow-visible" : "overflow-y-auto overscroll-y-contain",
          panelDropdownShellClass
        )}
        style={{
          top: pos.top,
          left: pos.left,
          minWidth: pos.width,
          maxHeight: manualOpen ? undefined : pos.maxHeight,
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((w) => (
          <button
            key={w}
            type="button"
            role="menuitem"
            className={panelMenuItemClass}
            onMouseDown={(e) => {
              e.preventDefault();
              pickWeeks(w);
            }}
          >
            +{w} {w === 1 ? "tydzień" : "tygodnie"}
          </button>
        ))}
        <div className="my-1 border-t border-slate-100" />
        {!manualOpen ? (
          <>
            <button
              type="button"
              role="menuitem"
              className={panelMenuItemClass}
              onClick={openManualDate}
            >
              Wybierz datę…
            </button>
            <p className="px-3 pb-2 text-[11px] leading-snug text-slate-500">
              Weekendy i polskie święta są automatycznie przesuwane na najbliższy dzień roboczy.
            </p>
          </>
        ) : (
          <div className="space-y-2 px-3 py-2">
            <label className="block text-[11px] font-medium text-slate-600">
              Nowy termin
              <input
                ref={dateInputRef}
                type="date"
                className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker();
                  } catch {
                    /* ignore */
                  }
                }}
              />
            </label>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="primary"
                disabled={!dateValue}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyDate();
                }}
              >
                OK
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setManualOpen(false);
                  setDateValue("");
                }}
              >
                Anuluj
              </Button>
            </div>
          </div>
        )}
      </div>
    ) : null;

  return (
    <div
      ref={anchorRef}
      className={cn("relative flex shrink-0", grouped && "shrink-0", compact && "min-w-0 flex-1")}
    >
      <Button
        type="button"
        variant={grouped ? "ghost" : "secondary"}
        size="sm"
        disabled={disabled}
        onClick={() => {
          if (open) close();
          else {
            setOpen(true);
            update();
          }
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          grouped && !compact && cn(panelSegmentControlClass, open && panelSegmentControlOpenClass),
          grouped &&
            compact &&
            "h-7 min-h-7 w-full !rounded-md border border-slate-200/90 px-2 text-xs font-medium text-slate-700 shadow-none hover:bg-indigo-50/60",
          className
        )}
      >
        <span className="inline-flex items-center justify-center gap-1">
          Przesuń
          <IconChevronDown size={14} open={open} />
        </span>
      </Button>
      {menuPanel ? createPortal(menuPanel, document.body) : null}
    </div>
  );
}
