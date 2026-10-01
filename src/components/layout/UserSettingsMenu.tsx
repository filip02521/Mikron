"use client";

import { useCallback, useState, useEffect, useRef, useId, useLayoutEffect } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { IconChevronDown, IconChevronRight, IconSun } from "@/components/icons/StrokeIcons";
import { resolveUserDisplayName } from "@/lib/users/display-name";
import { ROLE_LABELS } from "@/lib/users/labels";
import { LoginAccountRoleLine } from "@/components/auth/LoginAccountRoleLine";
import { computeAnchoredDropdownPosition } from "@/lib/ui/dropdown-anchor";
import { panelDropdownShellClass } from "@/lib/ui/ontime-theme";
import type { UserRole } from "@/types/database";
import type { VacationDelegationRow } from "@/lib/data/vacation-delegations";
import { cn } from "@/lib/cn";

type UserSettingsMenuProps = {
  role: UserRole | null;
  userEmail?: string | null;
  salesPersonName?: string | null;
  userAssignmentLabel?: string | null;
  workspaceSubtitle?: string | null;
  compact?: boolean;
  delegations?: VacationDelegationRow[];
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function initialsFromEmail(email: string): string {
  const local = (email.split("@")[0] ?? "").trim();
  if (!local) return "?";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export function UserSettingsMenu({
  role,
  userEmail,
  salesPersonName,
  userAssignmentLabel,
  workspaceSubtitle,
  compact = false,
  delegations = [],
}: UserSettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const hasDelegations = delegations.length > 0;

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuWidth = menuRef.current?.offsetWidth ?? 220;
    const measured = menuRef.current?.scrollHeight ?? menuRef.current?.offsetHeight;
    const menuHeight = measured && measured > 0 ? measured : 240;
    const { top, left, maxHeight } = computeAnchoredDropdownPosition(rect, menuHeight, {
      minWidth: menuWidth,
    });
    setMenuPos({ top, left, maxHeight });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

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

  if (!role && !userEmail && !salesPersonName) return null;

  const displayName = resolveUserDisplayName({ salesPersonName, email: userEmail });
  const primaryLabel = displayName || userEmail?.trim() || null;
  const initials = primaryLabel
    ? displayName
      ? initialsFromName(displayName)
      : userEmail
        ? initialsFromEmail(userEmail)
        : initialsFromName(primaryLabel)
    : "?";
  const roleLineLabel = workspaceSubtitle ?? (role ? ROLE_LABELS[role] : null);

  const triggerContent = compact ? (
    <div className="min-w-0 flex-1 text-left">
      {primaryLabel ? (
        <p className="truncate text-[11px] font-semibold leading-tight text-slate-900">
          {primaryLabel}
        </p>
      ) : null}
      {role ? (
        <p className="min-w-0">
          <LoginAccountRoleLine
            role={role}
            roleLabel={roleLineLabel ?? ROLE_LABELS[role]}
            assignmentLabel={userAssignmentLabel}
            compact
          />
        </p>
      ) : null}
    </div>
  ) : (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 ring-1 ring-slate-200/80"
        aria-hidden
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        {primaryLabel ? (
          <p className="truncate text-sm font-semibold leading-tight text-slate-900">
            {primaryLabel}
          </p>
        ) : (
          <p className="text-sm font-medium text-slate-500">Niezalogowany</p>
        )}
        {role ? (
          <p className="min-w-0">
            <LoginAccountRoleLine
              role={role}
              roleLabel={roleLineLabel ?? ROLE_LABELS[role]}
              assignmentLabel={userAssignmentLabel}
            />
          </p>
        ) : null}
      </div>
    </div>
  );

  const menuPanel =
    open && menuPos && hasDelegations ? (
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        className={cn(
          "fixed z-[200] min-w-[14rem] overflow-y-auto overscroll-y-contain",
          panelDropdownShellClass
        )}
        style={{ top: menuPos.top, left: menuPos.left, maxHeight: menuPos.maxHeight }}
      >
        <div className="flex items-center gap-2 px-3 pb-1 pt-2">
          <IconSun size={14} className="shrink-0 text-amber-500" />
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400" role="presentation">
            Wybierz panel ({delegations.length})
          </p>
        </div>
        {delegations.map((d) => (
          <Link
            key={d.id}
            href={`/moje?dla=${d.salesPersonId}`}
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-indigo-50/80 hover:text-indigo-950"
            onClick={() => setOpen(false)}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-700" aria-hidden>
              {initialsFromName(d.salesPersonName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium leading-tight">{d.salesPersonName}</span>
              <span className="block text-[10px] leading-tight text-slate-400">do {d.endDate}</span>
            </span>
            <IconChevronRight size={14} className="shrink-0 text-slate-300" />
          </Link>
        ))}
      </div>
    ) : null;

  const showDropdownTrigger = delegations.length > 2;

  if (hasDelegations) {
    return (
      <>
        <div ref={rootRef} className={compact ? "mt-1 min-w-0" : "mt-4 border-t border-slate-100 pt-4"}>
          {/* User info — static, not clickable */}
          <div
            className={cn(
              "flex w-full min-w-0 items-center gap-2 rounded-md",
              compact ? "px-1 py-0.5" : "px-1 py-1"
            )}
          >
            {triggerContent}
          </div>

          {/* Always-visible delegation strip */}
          <div className="mt-2 space-y-1">
            {delegations.slice(0, 2).map((d) => (
              <Link
                key={d.id}
                href={`/moje?dla=${d.salesPersonId}`}
                className={cn(
                  "group flex items-center gap-2 rounded-lg border border-amber-200/60 bg-amber-50/50 px-2 py-1.5 transition-colors hover:border-amber-300 hover:bg-amber-50",
                  compact && "py-1"
                )}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-700"
                  aria-hidden
                >
                  {initialsFromName(d.salesPersonName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <IconSun size={11} className="shrink-0 text-amber-500" />
                    <span className="truncate text-[11px] font-semibold leading-tight text-amber-900">Zastępujesz</span>
                  </span>
                  <span className="block truncate text-[11px] font-medium leading-tight text-slate-700">{d.salesPersonName}</span>
                  <span className="block text-[9px] leading-tight text-slate-400">do {d.endDate}</span>
                </span>
                <IconChevronRight size={14} className="shrink-0 text-amber-400 transition-colors group-hover:text-amber-600" />
              </Link>
            ))}
          </div>

          {/* "Show all" button when 3+ delegations */}
          {showDropdownTrigger ? (
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-haspopup="menu"
              aria-controls={open ? menuId : undefined}
              className="mt-1 flex w-full items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-50"
            >
              +{delegations.length - 2} więcej zastępstw
              <IconChevronDown open={open} size={12} className="text-amber-500" />
            </button>
          ) : null}
        </div>
        {typeof document !== "undefined" && menuPanel
          ? createPortal(menuPanel, document.body)
          : null}
      </>
    );
  }

  return (
    <div className={compact ? "mt-1 min-w-0" : "mt-4 border-t border-slate-100 pt-4"}>
      <div
        className={cn(
          "flex w-full min-w-0 items-center gap-2 rounded-md",
          compact ? "px-1 py-0.5" : "px-1 py-1"
        )}
      >
        {triggerContent}
      </div>
    </div>
  );
}

