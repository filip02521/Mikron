"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { IconChevronDown } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { panelMenuItemClass, panelSegmentControlClass, panelSegmentControlOpenClass } from "@/lib/ui/ontime-theme";

function useMenuAnchor() {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(
    null
  );

  const update = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      top: r.bottom + 4,
      left: r.right,
      width: Math.max(r.width, 168),
    });
  }, []);

  return { anchorRef, pos, update, clear: () => setPos(null) };
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
  const { anchorRef, pos, update, clear } = useMenuAnchor();

  const close = useCallback(() => {
    setOpen(false);
    setManualOpen(false);
    setDateValue("");
    clear();
  }, [clear]);

  useEffect(() => {
    if (!open) return;
    update();
    const onScroll = () => update();
    const onResize = () => update();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, update]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      const panel = document.getElementById("shift-menu-panel");
      if (panel?.contains(t)) return;
      close();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, close, anchorRef]);

  const pickWeeks = (w: number) => {
    onShiftWeeks(w);
    close();
  };

  const applyDate = () => {
    if (!dateValue) return;
    onShiftDate(dateValue);
    close();
  };

  const menuPanel =
    open && pos && typeof document !== "undefined" ? (
      <div
        id="shift-menu-panel"
        role="menu"
        className="fixed z-[100] min-w-[168px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        style={{
          top: pos.top,
          left: pos.left,
          transform: "translateX(-100%)",
          minWidth: pos.width,
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
              onMouseDown={(e) => {
                e.preventDefault();
                setManualOpen(true);
              }}
            >
              Wybierz datę…
            </button>
            <p className="px-3 pb-2 text-[11px] leading-snug text-slate-500">
              Weekendy i polskie święta są automatycznie przesuwane na najbliższy dzień roboczy.
            </p>
          </>
        ) : (
          <div className="space-y-2 px-3 py-2">
            <input
              type="date"
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
            />
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
      className={cn("relative shrink-0", grouped && "shrink-0", compact && "min-w-0 flex-1")}
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
            "h-8 min-h-8 w-full !rounded-xl border border-slate-200/90 px-2 text-xs font-medium text-slate-700 shadow-none hover:bg-indigo-50/60",
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
