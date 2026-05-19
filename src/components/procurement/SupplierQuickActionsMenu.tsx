"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ShiftMenu } from "@/components/summary/ShiftMenu";
import { actionMarkOrdered, actionShiftOrder } from "@/app/actions/admin";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import type { SupplierLocation } from "@/types/database";

export function SupplierQuickActionsMenu({
  supplierId,
  supplierName,
  location,
  pending,
  run,
  onOpenDetails,
  onVacation,
  onEdit,
  align = "end",
}: {
  supplierId: string;
  supplierName: string;
  location: SupplierLocation;
  pending: boolean;
  run: DailyPanelRunFn;
  onOpenDetails?: () => void;
  onVacation: () => void;
  onEdit: () => void;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const scheduleHref = `/lokalizacje/${location}`;

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Więcej akcji — ${supplierName}`}
      >
        ⋮
      </Button>
      {open ? (
        <div
          role="menu"
          className={`absolute z-30 mt-1 min-w-[200px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg ${
            align === "end" ? "right-0" : "left-0"
          }`}
        >
          <MenuItem
            onClick={() => {
              setOpen(false);
              run(
                () => actionMarkOrdered(supplierId),
                "Oznaczono jako zamówione",
                "Oznaczanie jako zamówione…"
              );
            }}
          >
            Zamówione
          </MenuItem>
          <div className="border-t border-slate-100 px-3 py-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Przesuń termin
            </p>
            <ShiftMenu
              disabled={pending}
              onShiftWeeks={(w) => {
                setOpen(false);
                run(
                  () => actionShiftOrder(supplierId, w, null),
                  `Przesunięto o ${w} ${w === 1 ? "tydzień" : "tygodnie"}`,
                  `Przesuwanie o ${w} tyg.…`
                );
              }}
              onShiftDate={(iso) => {
                setOpen(false);
                run(
                  () => actionShiftOrder(supplierId, null, iso),
                  "Ustawiono datę przesunięcia",
                  "Zapisywanie nowej daty…"
                );
              }}
            />
          </div>
          <MenuItem
            onClick={() => {
              setOpen(false);
              onVacation();
            }}
          >
            Urlop…
          </MenuItem>
          <MenuItem
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            Edytuj kartę
          </MenuItem>
          <Link
            href={scheduleHref}
            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Terminy ({location === "POLSKA" ? "PL" : location === "ZAGRANICA" ? "ZA" : "IMP"})
          </Link>
          {onOpenDetails ? (
            <MenuItem
              onClick={() => {
                setOpen(false);
                onOpenDetails();
              }}
            >
              Szczegóły
            </MenuItem>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
