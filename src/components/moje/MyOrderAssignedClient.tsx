"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { salesClientLabelClass, salesClientNameClass, salesTypography } from "@/lib/ui/ontime-theme";
import { SearchHighlightText } from "@/components/moje/SearchHighlightText";
import { actionFetchClientNip } from "@/app/actions/subiekt";

type CopyState = "idle" | "loading" | "copied" | "error";

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
  const trimmed = name.trim();
  if (!trimmed) return null;

  const hasKhId = clientKhId != null && clientKhId > 0;

  async function handleCopyNip(e: React.MouseEvent) {
    e.stopPropagation();
    if (!hasKhId || !clientKhId) return;
    setCopyState("loading");
    try {
      const { nip } = await actionFetchClientNip(clientKhId);
      if (!nip) {
        setCopyState("error");
        setTimeout(() => setCopyState("idle"), 2000);
        return;
      }
      await navigator.clipboard.writeText(nip);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 2000);
    }
  }

  const badgeLabel =
    copyState === "loading" ? "…" :
    copyState === "copied" ? "Skopiowano!" :
    copyState === "error" ? "Brak NIP" :
    "Klient";

  const badgeClass = cn(
    salesClientLabelClass,
    "gap-0.5",
    hasKhId && "cursor-pointer select-none transition-colors",
    copyState === "copied" && "text-emerald-600",
    copyState === "error" && "text-red-500",
  );

  const BadgeTag = hasKhId ? "button" : "span";

  return (
    <p className={cn(salesTypography.rowMeta, "flex items-center gap-1", className)}>
      <BadgeTag
        type={hasKhId ? "button" : undefined}
        onClick={hasKhId ? handleCopyNip : undefined}
        title={hasKhId ? "Kliknij, aby skopiować NIP klienta" : undefined}
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
