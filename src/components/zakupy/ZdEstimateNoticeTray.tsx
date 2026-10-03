"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import type { NoticeTone } from "@/lib/ui/notice-content";
import { IconAlertCircle, IconChevronDown, IconInfoCircle } from "@/components/icons/StrokeIcons";

/**
 * Pasek „Uwagi” kreatora ZD: ostrzeżenia i informacje nie stoją w stosie nad tabelą,
 * tylko w jednej linii z tytułami; pełna treść (z przyciskami akcji) otwiera się
 * w pływającym panelu nad tabelą — bez przesuwania obszaru roboczego.
 *
 * Komunikat trafia do paska przez `<ZdEstimateNotice tray>`: rejestruje tytuł i ton
 * w kontekście, a treść renderuje portalem do panelu. Bez providera (inne ekrany)
 * `tray` jest ignorowane i komunikat zostaje w miejscu.
 */

type TrayEntry = { id: string; tone: NoticeTone; title: string; order: number };

type TrayContextValue = {
  register: (entry: Omit<TrayEntry, "order">) => void;
  unregister: (id: string) => void;
  panel: HTMLElement | null;
};

const TrayContext = createContext<TrayContextValue | null>(null);

const TONE_RANK: Record<NoticeTone, number> = { error: 0, warning: 1, info: 2, success: 3 };

export function ZdEstimateNoticeTrayProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<TrayEntry[]>([]);
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const orderRef = useRef(0);

  const register = useCallback((entry: Omit<TrayEntry, "order">) => {
    setEntries((prev) => {
      const existing = prev.find((e) => e.id === entry.id);
      if (existing && existing.tone === entry.tone && existing.title === entry.title) return prev;
      const order = existing?.order ?? orderRef.current++;
      return [...prev.filter((e) => e.id !== entry.id), { ...entry, order }];
    });
  }, []);
  const unregister = useCallback((id: string) => {
    setEntries((prev) => (prev.some((e) => e.id === id) ? prev.filter((e) => e.id !== id) : prev));
  }, []);

  const value = useMemo(() => ({ register, unregister, panel }), [register, unregister, panel]);
  return (
    <TrayContext.Provider value={value}>
      <TrayStateContext.Provider value={{ entries, open, setOpen, setPanel }}>{children}</TrayStateContext.Provider>
    </TrayContext.Provider>
  );
}

const TrayStateContext = createContext<{
  entries: TrayEntry[];
  open: boolean;
  setOpen: (next: boolean | ((v: boolean) => boolean)) => void;
  setPanel: (el: HTMLElement | null) => void;
} | null>(null);

/** Rejestracja komunikatu w pasku; zwraca panel docelowy portalu albo null (brak providera). */
export function useZdEstimateNoticeTray(
  enabled: boolean,
  id: string,
  tone: NoticeTone,
  title: string
): { inTray: boolean; panel: HTMLElement | null } {
  const ctx = useContext(TrayContext);
  const active = enabled && ctx != null;
  const register = ctx?.register;
  const unregister = ctx?.unregister;
  useEffect(() => {
    if (!active || !register || !unregister) return;
    register({ id, tone, title });
    return () => unregister(id);
  }, [active, register, unregister, id, tone, title]);
  return { inTray: active, panel: ctx?.panel ?? null };
}

/** Jedna linia nad tabelą: „Uwagi (3): tytuł · tytuł +1 [Pokaż]”, panel z pełną treścią. */
export function ZdEstimateNoticeTrayBar({ className }: { className?: string }) {
  const state = useContext(TrayStateContext);
  const rootRef = useRef<HTMLDivElement>(null);
  const entries = useMemo(
    () =>
      [...(state?.entries ?? [])].sort(
        (a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone] || a.order - b.order
      ),
    [state?.entries]
  );
  const open = Boolean(state?.open && entries.length);
  const setOpen = state?.setOpen;
  const setPanel = state?.setPanel;
  const panelRef = useCallback((el: HTMLDivElement | null) => setPanel?.(el), [setPanel]);

  useEffect(() => {
    if (!open || !setOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, setOpen]);

  if (!state) return null;
  const worst = entries[0]?.tone ?? "info";
  const shown = entries.slice(0, 2);
  const rest = entries.length - shown.length;
  const toneClass =
    worst === "error"
      ? "border-red-200 bg-red-50/90 text-red-950"
      : worst === "warning"
        ? "border-amber-200 bg-amber-50/90 text-amber-950"
        : "border-slate-200 bg-white/90 text-slate-800";

  return (
    <div ref={rootRef} className={cn("relative shrink-0", !entries.length && "hidden", className)}>
      {entries.length ? (
        <button
          type="button"
          onClick={() => setOpen?.((v) => !v)}
          aria-expanded={open}
          aria-controls="zd-estimate-notice-tray-panel"
          className={cn(
            "flex h-8 w-full items-center gap-2 rounded-md border px-2.5 text-left text-sm shadow-sm transition hover:brightness-[0.98]",
            toneClass
          )}
        >
          {worst === "info" || worst === "success" ? (
            <IconInfoCircle size={15} className="shrink-0 text-indigo-600" />
          ) : (
            <IconAlertCircle size={15} className={cn("shrink-0", worst === "error" ? "text-red-600" : "text-amber-600")} />
          )}
          <span className="shrink-0 font-semibold">Uwagi ({entries.length})</span>
          <span className="min-w-0 flex-1 truncate opacity-80">
            {shown.map((e) => e.title).join(" · ")}
            {rest > 0 ? ` · +${rest}` : ""}
          </span>
          <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium opacity-70">
            {open ? "Ukryj" : "Pokaż"}
            <IconChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} />
          </span>
        </button>
      ) : null}
      {/* Panel zawsze w DOM — cel portali komunikatów; widoczny tylko po otwarciu. */}
      <div
        id="zd-estimate-notice-tray-panel"
        ref={panelRef}
        role="region"
        aria-label="Uwagi kreatora ZD"
        className={cn(
          "absolute inset-x-0 top-full z-30 mt-1 max-h-[min(60vh,32rem)] space-y-2 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10",
          !open && "hidden"
        )}
      />
    </div>
  );
}
