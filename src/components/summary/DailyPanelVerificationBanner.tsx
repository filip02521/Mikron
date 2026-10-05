"use client";

import Link from "next/link";
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
  edge = "row",
  className,
}: {
  count: number;
  onOpenModal: () => void;
  edge?: PageAttentionStripEdge;
  className?: string;
}) {
  if (count <= 0) return null;

  const label = `${count} ${verificationNoun(count)} do uzupełnienia`;

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
      hint="brak danych blokuje kolejkę próśb."
      actions={
        <>
          <Link
            href="/weryfikacja"
            className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-amber-900/80 transition-colors hover:text-amber-950 hover:underline"
          >
            Pełny widok
          </Link>
          <PageAttentionStripCta chevron={false} onClick={onOpenModal}>
            Uzupełnij
          </PageAttentionStripCta>
        </>
      }
    />
  );
}

/** 1 zgłoszenie, 2–4 zgłoszenia (poza 12–14), 5+ zgłoszeń. */
export function verificationNoun(count: number): string {
  if (count === 1) return "zgłoszenie";
  const mod10 = count % 10;
  const mod100 = count % 100;
  return mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "zgłoszenia" : "zgłoszeń";
}
