"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";

export function ShiftMenu({
  disabled,
  onShiftWeeks,
  onShiftDate,
}: {
  disabled?: boolean;
  onShiftWeeks: (weeks: number) => void;
  onShiftDate: (isoDate: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [dateValue, setDateValue] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setManualOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const applyDate = () => {
    if (!dateValue) return;
    onShiftDate(dateValue);
    setOpen(false);
    setManualOpen(false);
    setDateValue("");
  };

  return (
    <div ref={ref} className="relative">
      <Button
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        Przesuń ▾
      </Button>
      {open ? (
        <div
          className="absolute right-0 z-20 mt-1 min-w-[168px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          role="menu"
        >
          {[1, 2, 3, 4, 5, 6].map((w) => (
            <button
              key={w}
              type="button"
              role="menuitem"
              className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => {
                onShiftWeeks(w);
                setOpen(false);
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
                className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setManualOpen(true)}
              >
                Wybierz datę…
              </button>
              <p className="px-3 pb-2 text-[11px] leading-snug text-slate-500">
                Weekendy i polskie święta są automatycznie przesuwane na najbliższy dzień
                roboczy.
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
                <Button size="sm" variant="primary" disabled={!dateValue} onClick={applyDate}>
                  OK
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
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
      ) : null}
    </div>
  );
}
