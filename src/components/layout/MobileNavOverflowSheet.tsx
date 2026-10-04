"use client";

import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavIcon, navIconTileActiveClassForTone, navIconTileClassForTone } from "@/components/icons/NavIcon";
import { IconMoreVertical } from "@/components/icons/StrokeIcons";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { isNavItemActive, navItemDisplayTone, navItemHasDueReminders, type NavItem } from "@/lib/nav";
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
  sidebarNavAttentionIdleClass,
  sidebarNavBadgeClassForTone,
  sidebarNavToneActiveClass,
} from "@/lib/ui/ontime-theme";
import { SCROLL_LOCK_ALLOW_ATTR, useBodyScrollLock } from "@/lib/ui/page-scroll-lock";
import { useMonthlySummaryNeedsAttention } from "@/hooks/useMonthlySummaryAttention";
import { MONTHLY_SUMMARY_HREF } from "@/lib/monthly-summary-attention";

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
  switcher = null,
}: {
  items: NavItem[];
  previewDla?: string | null;
  adminSalesPreview?: boolean;
  navLocked?: boolean;
  switcher?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const hydrated = useClientHydrated();
  const monthlyNeedsAttention = useMonthlySummaryNeedsAttention();
  const allHrefs = items.map((item) => item.href);
  const activeInOverflow = items.some((item) =>
    overflowItemActive(pathname, item, allHrefs)
  );
  const overflowAttentionBadge = items.reduce(
    (max, item) => Math.max(max, item.badge != null && item.badge > 0 ? item.badge : 0),
    0
  );
  const hasMonthlyInOverflow = items.some((item) => item.href === MONTHLY_SUMMARY_HREF);
  const showMonthlyDot =
    hasMonthlyInOverflow && monthlyNeedsAttention && !activeInOverflow;

  useBodyScrollLock(open);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLButtonElement | null>(null);
  const close = useCallback((velocity = 0) => {
    const panel = panelRef.current;
    if (!panel || prefersReducedMotion()) {
      setOpen(false);
      return;
    }
    animateSheetTo(panel, backdropRef.current, panel.offsetHeight, velocity, () => setOpen(false));
  }, []);
  const drag = useSheetDrag(panelRef, backdropRef, close);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (items.length === 0 && !switcher) return null;

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
              ref={backdropRef}
              type="button"
              className="modal-backdrop-enter absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]"
              aria-label="Zamknij menu"
              onClick={() => close()}
            />
            <div
              ref={panelRef}
              className="sheet-enter absolute inset-x-0 bottom-0 max-h-[min(70vh,28rem)] overflow-y-auto rounded-t-xl border border-slate-200/90 bg-[var(--card)] shadow-[var(--shadow-card-elevated)] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
              {...{ [SCROLL_LOCK_ALLOW_ATTR]: "" }}
            >
              {/* Nagłówek = uchwyt: przeciągnij w dół, żeby zamknąć. Pełne tło — lista przewija się pod nim. */}
              <div
                className="sticky top-0 z-[1] touch-none select-none border-b border-slate-100 bg-[var(--card)] px-4 pb-3 pt-2"
                {...drag}
              >
                <span aria-hidden className="mx-auto mb-2 block h-1 w-9 rounded-full bg-slate-300" />
                <p className={panelTypography.rowTitle}>Więcej</p>
                <p className={cn(panelTypography.caption, "mt-0.5")}>
                  Pozostałe sekcje i narzędzia
                </p>
              </div>
              {switcher ? (
                <div className="border-b border-slate-100 px-3 py-3">{switcher}</div>
              ) : null}
              <ul className="space-y-1 p-2">
                {items.map((item) => {
                  const active = overflowItemActive(pathname, item, allHrefs);
                  const displayTone = navItemDisplayTone(item, active);
                  const attentionIdle = navItemHasDueReminders(item) && !active;
                  const monthlyIdle =
                    item.href === MONTHLY_SUMMARY_HREF && monthlyNeedsAttention && !active;
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
                            : attentionIdle
                              ? sidebarNavAttentionIdleClass
                              : monthlyIdle
                                ? "border border-violet-200/70 bg-violet-50/80 text-slate-800"
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
                              : navIconTileClassForTone(displayTone)
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
                        {monthlyIdle ? (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-violet-500 ring-2 ring-white"
                            title="Nowe podsumowanie miesiąca"
                          />
                        ) : null}
                        {hasBadge ? (
                          <span
                            className={cn(
                              "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none tabular-nums",
                              sidebarNavBadgeClassForTone(displayTone, active)
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
                  "absolute -right-1.5 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-md px-0.5 text-[8px] font-bold tabular-nums",
                  mobileNavBadgeClass
                )}
              >
                {overflowAttentionBadge > 9 ? "9+" : overflowAttentionBadge}
              </span>
            ) : showMonthlyDot ? (
              <span
                className="absolute -right-1 top-0 h-2 w-2 rounded-full bg-violet-500 ring-2 ring-white"
                title="Nowe podsumowanie miesiąca"
              />
            ) : null}
          </span>
          <span className="max-w-full truncate leading-tight">Więcej</span>
        </button>
      </li>
      {sheet}
    </>
  );
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Bieżące przesunięcie panelu na ekranie (także w trakcie animacji) — start kolejnego ruchu bez skoku. */
function currentTranslateY(el: HTMLElement): number {
  const t = getComputedStyle(el).transform;
  return t && t !== "none" ? new DOMMatrixReadOnly(t).m42 : 0;
}

/**
 * Dojazd panelu do `targetY` z prędkością palca (px/s) — bez szwu między gestem a animacją.
 * ponytail: krzywa ease-out o czasie z prędkości zamiast sprężyny; biblioteka sprężyn, gdy arkuszy przybędzie.
 */
function animateSheetTo(
  panel: HTMLElement,
  backdrop: HTMLElement | null,
  targetY: number,
  velocity: number,
  onDone?: () => void
) {
  const fromY = currentTranslateY(panel);
  panel.getAnimations().forEach((a) => a.cancel());
  const distance = Math.abs(targetY - fromY);
  const speed = Math.max(Math.abs(velocity), 900);
  const duration = Math.min(320, Math.max(140, (distance / speed) * 1000 * 1.6));
  const easing = "cubic-bezier(0.22, 1, 0.36, 1)";
  panel.style.transform = `translateY(${targetY}px)`;
  const anim = panel.animate(
    [{ transform: `translateY(${fromY}px)` }, { transform: `translateY(${targetY}px)` }],
    { duration, easing }
  );
  if (backdrop) {
    const h = panel.offsetHeight || 1;
    const opacity = (y: number) => String(1 - Math.min(1, Math.max(0, y / h)));
    backdrop.getAnimations().forEach((a) => a.cancel());
    backdrop.style.opacity = opacity(targetY);
    backdrop.animate([{ opacity: opacity(fromY) }, { opacity: opacity(targetY) }], { duration, easing });
  }
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    if (targetY === 0) panel.style.transform = "";
    onDone?.();
  };
  anim.onfinish = finish;
  // Przerwane (złapane palcem) — bez domknięcia; karta w tle — domknij mimo wstrzymanej animacji.
  anim.oncancel = () => {
    settled = true;
  };
  window.setTimeout(finish, duration + 150);
}

/** Rzut pędu jak przy przewijaniu (Apple, „Designing Fluid Interfaces”). */
function projectMomentum(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Opór przy ciągnięciu w górę (poza krawędź) — miękka granica zamiast twardego stopu. */
function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Przeciąganie arkusza 1:1 z palcem; puszczenie decyduje kierunek z prędkości i rzutu pędu. */
function useSheetDrag(
  panelRef: React.RefObject<HTMLDivElement | null>,
  backdropRef: React.RefObject<HTMLButtonElement | null>,
  close: (velocity?: number) => void
) {
  const state = useRef<{ startY: number; baseY: number; samples: { y: number; t: number }[] } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    if (!panel || (e.pointerType === "mouse" && e.button !== 0)) return;
    // Złap panel tam, gdzie jest teraz (także w trakcie wjazdu) — bez skoku.
    const baseY = currentTranslateY(panel);
    panel.getAnimations().forEach((a) => a.cancel());
    backdropRef.current?.getAnimations().forEach((a) => a.cancel());
    panel.style.transform = `translateY(${baseY}px)`;
    e.currentTarget.setPointerCapture(e.pointerId);
    state.current = { startY: e.clientY, baseY, samples: [{ y: e.clientY, t: e.timeStamp }] };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = state.current;
    const panel = panelRef.current;
    if (!s || !panel) return;
    const raw = s.baseY + e.clientY - s.startY;
    const y = raw < 0 ? rubberband(raw, panel.offsetHeight) : raw;
    panel.style.transform = `translateY(${y}px)`;
    if (backdropRef.current) {
      backdropRef.current.style.opacity = String(1 - Math.min(1, Math.max(0, y / panel.offsetHeight)));
    }
    s.samples.push({ y: e.clientY, t: e.timeStamp });
    if (s.samples.length > 5) s.samples.shift();
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = state.current;
    const panel = panelRef.current;
    state.current = null;
    if (!s || !panel) return;
    // Prędkość z ostatnich ~100 ms — pauza przed puszczeniem to brak pędu.
    const first = s.samples.find((p) => e.timeStamp - p.t <= 100);
    const dt = first ? e.timeStamp - first.t : 0;
    const velocity = first && dt > 0 ? ((e.clientY - first.y) / dt) * 1000 : 0;
    const y = currentTranslateY(panel);
    // Tap w uchwyt (bez ruchu) nic nie robi.
    if (Math.abs(e.clientY - s.startY) < 4) {
      animateSheetTo(panel, backdropRef.current, 0, 0);
      return;
    }
    const projected = y + projectMomentum(velocity);
    if (projected > panel.offsetHeight / 2) close(velocity);
    else animateSheetTo(panel, backdropRef.current, 0, velocity);
  };

  return { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd };
}
