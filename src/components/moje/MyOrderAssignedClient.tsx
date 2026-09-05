"use client";

import { useRef, useState, type MouseEvent } from "react";
import { cn } from "@/lib/cn";
import { salesClientLabelClass, salesClientNameClass, salesTypography } from "@/lib/ui/ontime-theme";
import { copyTextToClipboard } from "@/lib/ui/copy-text-to-clipboard";
import { SearchHighlightText } from "@/components/moje/SearchHighlightText";
import { actionFetchClientNip } from "@/app/actions/subiekt";

type CopyState = "idle" | "loading" | "copied" | "error" | "copy_failed";

/** Krótka etykieta klienta — tylko gdy już przypisany. */
export function MyOrderAssignedClient({
  name,
  clientKhId,
  className,
  searchQuery,
}: {
  name: string;
  clientKhId?: number | null;
  className?: string;
  searchQuery?: string | null;
}) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  /** undefined = jeszcze nie pobrano; null = brak NIP w Subiekcie. */
  const nipCacheRef = useRef<string | null | undefined>(undefined);
  const trimmed = name.trim();
  if (!trimmed) return null;

  const hasKhId = clientKhId != null && clientKhId > 0;

  async function ensureNip(): Promise<string | null> {
    if (!hasKhId || !clientKhId) return null;
    if (nipCacheRef.current !== undefined) return nipCacheRef.current;
    const { nip } = await actionFetchClientNip(clientKhId);
    nipCacheRef.current = nip;
    return nip;
  }

  function prefetchNip() {
    if (!hasKhId || nipCacheRef.current !== undefined) return;
    void ensureNip().catch(() => {
      nipCacheRef.current = null;
    });
  }

  async function handleCopyNip(e: MouseEvent) {
    e.stopPropagation();
    if (!hasKhId || !clientKhId) return;
    setCopyState("loading");
    try {
      const nip = await ensureNip();
      if (!nip) {
        setCopyState("error");
        setTimeout(() => setCopyState("idle"), 2000);
        return;
      }
      const ok = await copyTextToClipboard(nip);
      if (!ok) {
        setCopyState("copy_failed");
        setTimeout(() => setCopyState("idle"), 2000);
        return;
      }
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      nipCacheRef.current = undefined;
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 2000);
    }
  }

  const badgeLabel =
    copyState === "loading"
      ? "…"
      : copyState === "copied"
        ? "Skopiowano!"
        : copyState === "error"
          ? "Brak NIP"
          : copyState === "copy_failed"
            ? "Nie skopiowano"
            : "Klient";

  const badgeClass = cn(
    salesClientLabelClass,
    "gap-0.5",
    hasKhId && "cursor-pointer select-none transition-colors",
    copyState === "copied" && "text-emerald-600",
    (copyState === "error" || copyState === "copy_failed") && "text-red-500"
  );

  const BadgeTag = hasKhId ? "button" : "span";

  const title =
    !hasKhId
      ? undefined
      : copyState === "copied"
        ? "NIP skopiowany do schowka"
        : copyState === "error"
          ? "Brak NIP w Subiekcie dla tego klienta"
          : copyState === "copy_failed"
            ? "Nie udało się skopiować NIP — spróbuj ponownie"
            : "Kliknij, aby skopiować NIP klienta";

  return (
    <p className={cn(salesTypography.rowMeta, "flex items-center gap-1", className)}>
      <BadgeTag
        type={hasKhId ? "button" : undefined}
        onClick={hasKhId ? handleCopyNip : undefined}
        onMouseEnter={hasKhId ? prefetchNip : undefined}
        onFocus={hasKhId ? prefetchNip : undefined}
        title={title}
        className={badgeClass}
      >
        <svg viewBox="0 0 16 16" className="size-3" fill="currentColor" aria-hidden>
          <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 13a5.5 5.5 0 0 1 11 0 .5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5Z" />
        </svg>
        {badgeLabel}
      </BadgeTag>
      <SearchHighlightText
        text={trimmed}
        searchQuery={searchQuery}
        className={cn(salesClientNameClass, "break-words")}
      />
    </p>
  );
}
