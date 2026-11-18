"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconBell, IconGripVertical, IconX } from "@/components/icons/StrokeIcons";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { SCROLL_LOCK_ALLOW_ATTR } from "@/lib/ui/page-scroll-lock";
import { cn } from "@/lib/cn";

const POS_KEY = "ontime:floating-notice-pill-pos";
const DRAG_THRESHOLD_PX = 4;
const EDGE_PX = 8;

type Pos = { x: number; y: number };
type Anchor = { left: number; top: number; right: number; bottom: number };

function readPos(): Pos | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(POS_KEY);
    const p = raw ? (JSON.parse(raw) as Partial<Pos>) : null;
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? clampPos({ x: p.x!, y: p.y! }, null) : null;
  } catch {
    return null;
  }
}

function savePos(p: Pos) {
  try {
    window.localStorage.setItem(POS_KEY, JSON.stringify(p));
  } catch {
    /* prywatne okno — pozycja tylko do końca wizyty */
  }
}

function clampPos(p: Pos, el: HTMLElement | null): Pos {
  const w = el?.offsetWidth ?? 192; // zmierzona pastylka: 187 px
  const h = el?.offsetHeight ?? 36;
  // shortcut: poniżej md stały zapas na dolny pasek nawigacji (3.25rem + safe area); zmierzyć pasek, gdyby zmienił wysokość.
  const bottomChrome = window.innerWidth < 768 ? 64 : 0;
  return {
    x: Math.min(Math.max(EDGE_PX, p.x), Math.max(EDGE_PX, window.innerWidth - w - EDGE_PX)),
    y: Math.min(Math.max(EDGE_PX, p.y), Math.max(EDGE_PX, window.innerHeight - h - EDGE_PX - bottomChrome)),
  };
}

function anchorOf(el: HTMLElement | null): Anchor | null {
  const r = el?.getBoundingClientRect();
  return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
}

/** Lista otwiera się od strony, po której jest więcej miejsca. */
function panelStyleFor(a: Anchor | null): React.CSSProperties {
  if (!a) return { right: 16, top: 56 };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const onRight = (a.left + a.right) / 2 > vw / 2;
  const below = (a.top + a.bottom) / 2 < vh / 2;
  return {
    ...(onRight ? { right: Math.max(EDGE_PX, vw - a.right) } : { left: Math.max(EDGE_PX, a.left) }),
    ...(below ? { top: a.bottom + 8 } : { bottom: vh - a.top + 8 }),
  };
}

/**
 * Powiadomienia strony (pasy znad treści) zwinięte w pastylkę z licznikiem, którą można przeciągnąć
 * w dowolne miejsce ekranu — ekran roboczy (Kreator ZD) nie traci przez nie wysokości.
 * Klik rozwija listę pasów; licznik = liczba widocznych pasów, przy zerze pastylki nie ma.
 */
export function FloatingNoticePill({ children }: { children: ReactNode }) {
  const mounted = useClientHydrated();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(readPos);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [fresh, setFresh] = useState(false);
  const pillRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const isOpen = open && count > 0;

  // Licznik z wyrenderowanych pasów: każdy pas sam decyduje, czy się pokazuje.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    let prev = 0;
    let freshTimer = 0;
    const recount = () => {
      const stack = body.querySelector<HTMLElement>('[role="region"]') ?? body;
      const n = stack.children.length;
      if (n > prev) {
        setFresh(true);
        window.clearTimeout(freshTimer);
        freshTimer = window.setTimeout(() => setFresh(false), 2500);
      }
      prev = n;
      setCount(n);
    };
    const mo = new MutationObserver(recount);
    mo.observe(body, { childList: true, subtree: true });
    queueMicrotask(recount); // pasy wyrenderowane przed podpięciem obserwatora
    return () => {
      mo.disconnect();
      window.clearTimeout(freshTimer);
    };
  }, [mounted]);

  useEffect(() => {
    const onResize = () => {
      setPos((p) => (p ? clampPos(p, pillRef.current) : p));
      setAnchor(anchorOf(pillRef.current));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (pillRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [isOpen]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < DRAG_THRESHOLD_PX) return;
    if (!d.moved) {
      d.moved = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* wskaźnik już puszczony — przeciąganie i tak idzie z ruchów */
      }
    }
    const el = e.currentTarget;
    const next = clampPos({ x: e.clientX - d.dx, y: e.clientY - d.dy }, el);
    setPos(next);
    setAnchor({ left: next.x, top: next.y, right: next.x + el.offsetWidth, bottom: next.y + el.offsetHeight });
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId || !d.moved) return;
    suppressClick.current = true; // klik kończący przeciąganie nie rozwija listy
    const r = e.currentTarget.getBoundingClientRect();
    savePos({ x: r.left, y: r.top });
  };
  const onButtonClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setAnchor(anchorOf(pillRef.current));
    setOpen((o) => !o);
  };

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        ref={pillRef}
        className={cn(
          "fixed z-50 touch-none select-none",
          count === 0 && "hidden",
          // Domyślnie środek górnego pasa — tam nagłówek strony nie ma przycisków.
          !pos && "left-1/2 top-2.5 -translate-x-1/2 md:left-[calc(50%+var(--app-sidebar-w,0px)/2)]"
        )}
        style={pos ? { left: pos.x, top: pos.y } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
      >
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label={`Powiadomienia: ${count}. Kliknij, by rozwinąć; przeciągnij, by przesunąć.`}
          title="Kliknij, by zobaczyć · przeciągnij, by przesunąć"
          onClick={onButtonClick}
          className={cn(
            "flex h-9 cursor-grab items-center gap-1.5 rounded-full border border-slate-300 bg-raised py-1 pl-1.5 pr-1.5 text-sm font-medium text-slate-800 shadow-[var(--shadow-card-elevated)] transition-[box-shadow,background-color] hover:bg-slate-50 active:cursor-grabbing",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
            isOpen && "border-indigo-300 bg-indigo-50",
            fresh && "ring-2 ring-indigo-300 motion-safe:animate-pulse"
          )}
        >
          <IconGripVertical size={16} className="text-slate-400" aria-hidden />
          <IconBell size={16} strokeWidth={2.25} className="text-indigo-700" aria-hidden />
          <span>Powiadomienia</span>
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-semibold tabular-nums text-white">
            {count}
          </span>
        </button>
      </div>
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Powiadomienia"
        hidden={!isOpen}
        className="fixed z-50 flex max-h-[min(70vh,32rem)] w-[min(30rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-md border border-slate-200/80 bg-raised shadow-[var(--shadow-card-elevated)] ring-1 ring-slate-900/5"
        style={panelStyleFor(anchor)}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-3 py-2">
          <h2 className="text-sm font-semibold text-slate-900">Powiadomienia</h2>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              buttonRef.current?.focus();
            }}
            aria-label="Zwiń powiadomienia"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <IconX size={16} aria-hidden />
          </button>
        </div>
        <div
          ref={bodyRef}
          {...{ [SCROLL_LOCK_ALLOW_ATTR]: "" }}
          className="overflow-y-auto p-2 [&>[role=region]]:mb-0"
        >
          {children}
        </div>
      </div>
    </>,
    document.body
  );
}
