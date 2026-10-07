"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { MojeSectionIconKind } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import {
  mojeSectionDomId,
  mojeSectionHeadingDomId,
} from "@/lib/orders/moje-section-focus";
import { mojeShipmentSectionShellClass } from "@/lib/ui/moje-shipment-row-styles";

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

/** Karta sekcji listy /moje — cel scrollu i podświetlenia Start dnia. */
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
        className={cn(mojeShipmentSectionShellClass, "scroll-mt-24", className)}
        aria-labelledby={mojeSectionHeadingDomId(sectionIcon)}
      >
        {children}
      </div>
    </HeaderSlotContext.Provider>
  );
}
