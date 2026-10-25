"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { MojeSectionIconKind } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import {
  mojeSectionDomId,
  mojeSectionHeadingDomId,
} from "@/lib/orders/moje-section-focus";

type HeaderSlot = { el: HTMLElement | null; setEl: (el: HTMLElement | null) => void };

const HeaderSlotContext = createContext<HeaderSlot | null>(null);

/** Miejsce w nagłówku sekcji na kontrolkę listy (np. „Rozwiń wszystkie”) — zamiast osobnego wiersza pod nagłówkiem. */
export function MojeSectionHeaderSlot() {
  const attachSlot = useContext(HeaderSlotContext)?.setEl;
  return attachSlot ? <span ref={attachSlot} className="contents" /> : null;
}

/** Element slotu nagłówka bieżącej sekcji; `null` poza sekcją /moje. */
export function useMojeSectionHeaderSlot(): HTMLElement | null {
  return useContext(HeaderSlotContext)?.el ?? null;
}

/** Sekcja listy /moje w karcie listy (bez własnej ramki) — cel scrollu i podświetlenia Start dnia. */
export function MojeSectionShell({
  sectionIcon,
  children,
  className,
}: {
  sectionIcon: MojeSectionIconKind;
  children: React.ReactNode;
  className?: string;
}) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const slot = useMemo(() => ({ el, setEl }), [el]);
  return (
    <HeaderSlotContext.Provider value={slot}>
      <div
        id={mojeSectionDomId(sectionIcon)}
        className={cn("scroll-mt-24 bg-white", className)}
        aria-labelledby={mojeSectionHeadingDomId(sectionIcon)}
      >
        {children}
      </div>
    </HeaderSlotContext.Provider>
  );
}
