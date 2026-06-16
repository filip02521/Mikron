"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NavIcon, navIconTileActiveClassForTone, navIconTileClassForTone } from "@/components/icons/NavIcon";
import { IconMoreVertical } from "@/components/icons/StrokeIcons";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { isNavItemActive, type NavItem } from "@/lib/nav";
import { hrefWithAdminSalesPreview } from "@/lib/nav/sales-preview-href";
import { cn } from "@/lib/cn";
import {
  controlFocusClass,
  mobileNavLinkActiveClass,
  mobileNavLinkBaseClass,
  mobileNavLinkIdleClass,
  mobileNavBadgeClass,
  navLinkIdleClass,
  panelTypography,
  sidebarNavBadgeClassForTone,
  sidebarNavToneActiveClass,
} from "@/lib/ui/ontime-theme";

function overflowItemActive(
  pathname: string,
  item: NavItem,
  allHrefs: string[]
): boolean {
  return isNavItemActive(pathname, item.href, allHrefs);
}

export function MobileNavOverflowSheet({
  items,
  previewDla = null,
  adminSalesPreview = false,
  navLocked = false,
}: {
  items: NavItem[];
  previewDla?: string | null;
  adminSalesPreview?: boolean;
  navLocked?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const hydrated = useClientHydrated();
  const allHrefs = items.map((item) => item.href);
  const activeInOverflow = items.some((item) =>
    overflowItemActive(pathname, item, allHrefs)
  );
  const overflowAttentionBadge = items.reduce(
    (max, item) => Math.max(max, item.badge != null && item.badge > 0 ? item.badge : 0),
    0
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (items.length === 0) return null;

  const sheet =
    open && hydrated
      ? createPortal(
          <div
            className="fixed inset-0 z-[60] md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Więcej w menu"
          >
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]"
              aria-label="Zamknij menu"
              onClick={() => setOpen(false)}
            />
            <div className="absolute inset-x-0 bottom-0 max-h-[min(70vh,28rem)] overflow-y-auto rounded-t-xl border border-slate-200/90 bg-[var(--card)] shadow-[var(--shadow-card-elevated)] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
              <div className="sticky top-0 z-[1] border-b border-indigo-100/70 bg-indigo-50/30 px-4 py-3">
                <p className={panelTypography.rowTitle}>Więcej</p>
                <p className={cn(panelTypography.caption, "mt-0.5")}>
                  Pozostałe sekcje i narzędzia
                </p>
              </div>
              <ul className="space-y-1 p-2">
                {items.map((item) => {
                  const active = overflowItemActive(pathname, item, allHrefs);
                  const href = hrefWithAdminSalesPreview(
                    item.href,
                    previewDla,
                    adminSalesPreview
                  );
                  const locked = navLocked && !active;
                  const hasBadge = item.badge != null && item.badge > 0;

                  return (
                    <li key={item.href}>
                      <Link
                        href={href}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2.5",
                          controlFocusClass,
                          active
                            ? sidebarNavToneActiveClass(item.tone)
                            : navLinkIdleClass,
                          locked && "pointer-events-none opacity-40"
                        )}
                        aria-current={active ? "page" : undefined}
                        onClick={(event) => {
                          if (locked) {
                            event.preventDefault();
                            return;
                          }
                          setOpen(false);
                        }}
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                            active
                              ? navIconTileActiveClassForTone(item.tone)
                              : navIconTileClassForTone(item.tone)
                          )}
                        >
                          <NavIcon navKey={item.icon} size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={panelTypography.rowTitle}>{item.label}</span>
                          {item.description ? (
                            <span className={cn(panelTypography.caption, "mt-0.5 block")}>
                              {item.description}
                            </span>
                          ) : null}
                        </span>
                        {hasBadge ? (
                          <span
                            className={cn(
                              "min-w-[1.25rem] rounded-md px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums",
                              sidebarNavBadgeClassForTone(item.tone, active)
                            )}
                          >
                            {item.badge! > 99 ? "99+" : item.badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <li className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            mobileNavLinkBaseClass,
            controlFocusClass,
            "w-full px-1",
            activeInOverflow ? mobileNavLinkActiveClass : mobileNavLinkIdleClass
          )}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <span className="relative">
            <IconMoreVertical size={20} className="text-current" />
            {overflowAttentionBadge > 0 && !activeInOverflow ? (
              <span
                className={cn(
                  "absolute -right-1.5 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[8px] font-bold tabular-nums",
                  mobileNavBadgeClass
                )}
              >
                {overflowAttentionBadge > 9 ? "9+" : overflowAttentionBadge}
              </span>
            ) : null}
          </span>
          <span className="max-w-full truncate leading-tight">Więcej</span>
        </button>
      </li>
      {sheet}
    </>
  );
}
