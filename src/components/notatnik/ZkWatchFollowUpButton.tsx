"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { actionUpdateZkWatchFollowUp } from "@/app/actions/sales-notepad";
import { IconCalendar } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { controlFocusClass, panelDropdownShellClass, panelToolbarIconButtonClass } from "@/lib/ui/ontime-theme";
import { formatFollowUpLabel, isFollowUpDue } from "@/lib/sales/notepad-follow-up";
import type { SalesZkWatch } from "@/types/database";
import { FollowUpQuickDates } from "./FollowUpQuickDates";

type PopoverPosition = { top: number; left: number };

export function ZkWatchFollowUpButton({
  watch,
  readOnly,
  tourPreview = false,
  archived,
  disabled,
  onSaved,
}: {
  watch: SalesZkWatch;
  readOnly?: boolean;
  tourPreview?: boolean;
  archived?: boolean;
  disabled?: boolean;
  onSaved?: (watch: SalesZkWatch) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PopoverPosition | null>(null);
  const [followUpDraft, setFollowUpDraft] = useState(watch.follow_up_at?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  const canEdit = !readOnly && !tourPreview && !archived;
  const followUpDue = !archived && isFollowUpDue(watch.follow_up_at);
  const followUpLabel = formatFollowUpLabel(watch.follow_up_at);
  const followUpDay = watch.follow_up_at?.slice(8, 10) ?? null;
  const hasFollowUp = Boolean(followUpLabel);

  useEffect(() => {
    setFollowUpDraft(watch.follow_up_at?.slice(0, 10) ?? "");
  }, [watch.follow_up_at]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const panelWidth = panelRef.current?.offsetWidth ?? 240;
      setPos({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 8)),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function saveFollowUp(nextValue?: string) {
    if (!canEdit || saving) return;
    const value = (nextValue ?? followUpDraft).trim();
    const normalized = value || null;
    if (normalized === (watch.follow_up_at?.slice(0, 10) ?? null)) {
      setOpen(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { watch: updated } = await actionUpdateZkWatchFollowUp(watch.id, normalized);
      setFollowUpDraft(updated.follow_up_at?.slice(0, 10) ?? "");
      onSaved?.(updated);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać przypomnienia.");
    } finally {
      setSaving(false);
    }
  }

  function handleTriggerClick(event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!canEdit) return;
    setOpen((value) => !value);
  }

  if (!canEdit && !followUpLabel) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-zk-row-action=""
        disabled={disabled || (!canEdit && !followUpLabel)}
        onClick={handleTriggerClick}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          followUpLabel
            ? `Przypomnienie: ${followUpLabel}${followUpDue ? " — do działania" : ""}`
            : "Ustaw przypomnienie"
        }
        title={
          followUpLabel
            ? `Przyp. ${followUpLabel}${followUpDue ? " — do działania" : ""}`
            : "Przypomnienie"
        }
        className={cn(
          panelToolbarIconButtonClass,
          "relative h-10 w-10 sm:h-7 sm:w-7",
          !hasFollowUp &&
            "border-dashed border-slate-200/90 bg-slate-50/40 text-slate-400 shadow-none hover:border-slate-300 hover:bg-slate-100/70 hover:text-slate-600",
          hasFollowUp &&
            !followUpDue &&
            "border-violet-500 bg-violet-600 text-white shadow-md ring-2 ring-violet-200/80 hover:border-violet-600 hover:bg-violet-700 hover:text-white",
          followUpDue &&
            "border-amber-500 bg-amber-500 text-white shadow-md ring-2 ring-amber-200/80 hover:border-amber-600 hover:bg-amber-600 hover:text-white",
          open &&
            (hasFollowUp
              ? "ring-offset-1"
              : "border-indigo-300 bg-indigo-50 text-indigo-700")
        )}
      >
        <IconCalendar size={hasFollowUp ? 16 : 15} />
        {followUpDay ? (
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-0.5 text-[9px] font-bold leading-none",
              followUpDue ? "bg-white text-amber-700" : "bg-white text-violet-700"
            )}
          >
            {Number(followUpDay)}
          </span>
        ) : null}
      </button>

      {open && pos && canEdit
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Przypomnienie"
              className={cn("fixed z-[200] w-60 p-3", panelDropdownShellClass)}
              style={{ top: pos.top, left: pos.left }}
              onClick={(event) => event.stopPropagation()}
            >
              <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wide text-slate-500">
                Przypomnienie
              </p>
              <FollowUpQuickDates
                value={followUpDraft || null}
                disabled={saving}
                onPick={(iso) => {
                  setFollowUpDraft(iso);
                  void saveFollowUp(iso);
                }}
              />
              <div className="mt-2 space-y-2">
                <label htmlFor={inputId} className="sr-only">
                  Data przypomnienia
                </label>
                <input
                  id={inputId}
                  type="date"
                  value={followUpDraft}
                  disabled={saving}
                  onChange={(e) => setFollowUpDraft(e.target.value)}
                  className={cn(
                    "h-8 w-full rounded-md border border-slate-200/80 bg-white px-2 text-xs",
                    controlFocusClass
                  )}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveFollowUp()}
                    className="rounded px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    {saving ? "Zapis…" : "Zapisz"}
                  </button>
                  {followUpDraft ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setFollowUpDraft("");
                        void saveFollowUp("");
                      }}
                      className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-black/5 disabled:opacity-50"
                    >
                      Wyczyść
                    </button>
                  ) : null}
                </div>
              </div>
              {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
