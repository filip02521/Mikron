"use client";

import { Button } from "@/components/ui/Button";
import { IconClipboardPen } from "@/components/icons/StrokeIcons";
import {
  PageAttentionStrip,
  PageAttentionStripCta,
  type PageAttentionStripEdge,
} from "@/components/ui/PageAttentionStrip";
import { cn } from "@/lib/cn";
import { panelChromeInsetClass } from "@/lib/ui/ontime-theme";

export function DailyPanelVerificationBanner({
  count,
  onOpenModal,
  edge = "flush",
  className,
}: {
  count: number;
  onOpenModal: () => void;
  edge?: PageAttentionStripEdge;
  className?: string;
}) {
  if (count <= 0) return null;

  const label =
    count === 1
      ? "1 zgłoszenie do uzupełnienia"
      : `${count} zgłoszeń do uzupełnienia`;

  return (
    <PageAttentionStrip
      tone="amber"
      edge={edge}
      className={cn(
        edge === "flush" && "border-b border-amber-200/65",
        edge === "flush" && panelChromeInsetClass,
        edge === "flush" && "px-3 py-2.5 sm:px-4",
        className
      )}
      icon={<IconClipboardPen size={17} strokeWidth={2.25} />}
      title={label}
      hint="brak danych blokuje kolejkę prośb."
      actions={
        <>
          <Button variant="primary" size="sm" className="h-8" onClick={onOpenModal}>
            Uzupełnij
          </Button>
          <PageAttentionStripCta href="/weryfikacja">Pełny widok</PageAttentionStripCta>
        </>
      }
    />
  );
}
