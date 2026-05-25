"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { IconMoreVertical } from "@/components/icons/StrokeIcons";
import { ShiftMenu } from "@/components/summary/ShiftMenu";
import { cn } from "@/lib/cn";
import { actionMarkOrdered, actionShiftOrder } from "@/app/actions/admin";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import type { SupplierLocation } from "@/types/database";

function useMenuAnchor() {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const update = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.right });
  }, []);

  return { anchorRef, pos, update, clear: () => setPos(null) };
}

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
  grouped = false,
  compact = false,
  includeOrderActions = true,
  runScope,
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
  grouped?: boolean;
  compact?: boolean;
  includeOrderActions?: boolean;
  runScope?: string;
}) {
  const scopeOpt = runScope ? { scope: runScope } : undefined;
  const [open, setOpen] = useState(false);
  const { anchorRef, pos, update, clear } = useMenuAnchor();
  const scheduleHref = `/lokalizacje/${location}`;

  const close = useCallback(() => {
    setOpen(false);
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
      const panel = document.getElementById(`supplier-menu-${supplierId}`);
      if (panel?.contains(t)) return;
      close();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, close, anchorRef, supplierId]);

  const menuPanel =
    open && pos && typeof document !== "undefined" ? (
      <div
        id={`supplier-menu-${supplierId}`}
        role="menu"
        className="fixed z-[100] min-w-[200px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        style={{
          top: pos.top,
          left: align === "end" ? pos.left : anchorRef.current?.getBoundingClientRect().left,
          transform: align === "end" ? "translateX(-100%)" : undefined,
        }}
      >
        {includeOrderActions ? (
          <>
            <MenuItem
              onSelect={() => {
                close();
                run(
                  () => actionMarkOrdered(supplierId),
                  "Oznaczono jako zamówione",
                  "Oznaczanie jako zamówione…",
                  scopeOpt
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
                  close();
                  run(
                    () => actionShiftOrder(supplierId, w, null),
                    `Przesunięto o ${w} ${w === 1 ? "tydzień" : "tygodnie"}`,
                    `Przesuwanie o ${w} tyg.…`,
                    scopeOpt
                  );
                }}
                onShiftDate={(iso) => {
                  close();
                  run(
                    () => actionShiftOrder(supplierId, null, iso),
                    "Ustawiono datę przesunięcia",
                    "Zapisywanie nowej daty…",
                    scopeOpt
                  );
                }}
              />
            </div>
          </>
        ) : null}
        <MenuItem
          onSelect={() => {
            close();
            onVacation();
          }}
        >
          Urlop…
        </MenuItem>
        <MenuItem
          onSelect={() => {
            close();
            onEdit();
          }}
        >
          Edytuj kartę
        </MenuItem>
        <Link
          href={scheduleHref}
          className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          onMouseDown={(e) => {
            e.preventDefault();
            close();
          }}
        >
          Terminy ({location === "POLSKA" ? "PL" : location === "ZAGRANICA" ? "ZA" : "IMP"})
        </Link>
        {onOpenDetails ? (
          <MenuItem
            onSelect={() => {
              close();
              onOpenDetails();
            }}
          >
            Szczegóły
          </MenuItem>
        ) : null}
      </div>
    ) : null;

  return (
    <div ref={anchorRef} className={cn("relative shrink-0", grouped && "shrink-0")}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (open) close();
          else {
            setOpen(true);
            update();
          }
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Więcej akcji — ${supplierName}`}
        className={cn(
          grouped &&
            !compact &&
            "min-h-9 min-w-10 shrink-0 !rounded-none rounded-r-xl border-0 border-l border-slate-200 px-1.5 shadow-none hover:bg-slate-50",
          grouped &&
            compact &&
            "h-8 min-h-8 min-w-9 shrink-0 rounded-lg border border-slate-200 px-1.5 shadow-none hover:bg-slate-50"
        )}
      >
        {grouped ? (
          <IconMoreVertical size={compact ? 18 : 20} className="text-slate-600" />
        ) : (
          <span className="text-lg leading-none text-slate-600" aria-hidden>
            ⋮
          </span>
        )}
      </Button>
      {menuPanel ? createPortal(menuPanel, document.body) : null}
    </div>
  );
}

function MenuItem({
  children,
  onSelect,
}: {
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect();
      }}
    >
      {children}
    </button>
  );
}
