"use client";

import Link from "next/link";
import { AppBrandFooterLine } from "@/components/layout/AppBrandContentFooter";
import {
  panelContentFooterClass,
  panelContentFooterLinkClass,
} from "@/lib/ui/ontime-theme";

/** Lekka stopka na dole karty panelu — linki i marka po scrollu listy. */
export function DailyPanelContentFooter() {
  return (
    <footer className={panelContentFooterClass} aria-label="Stopka panelu dziennego">
      <nav
        aria-label="Skróty panelu dziennego"
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
      >
        <Link
          href="/lokalizacje/POLSKA"
          className={panelContentFooterLinkClass}
          title="Harmonogram i legenda kolorów terminów (PL / ZA / Import)"
        >
          Terminy
        </Link>
        <Link href="/zakupy/tablica" className={panelContentFooterLinkClass}>
          Tablica
        </Link>
        {/* Pomoc jest w przyklejonym pasku akcji (ta sama treść) — tu bez duplikatu. */}
      </nav>

      <div className="mt-3 space-y-1 text-center">
        <AppBrandFooterLine />
      </div>
    </footer>
  );
}
