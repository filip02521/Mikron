"use client";

import Link from "next/link";
import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { HelpBlock } from "@/components/ui/HelpBlock";
import type { NotatnikSurface } from "@/lib/sales/notepad-page-tabs";
import { useSalesPreviewHref } from "@/lib/nav/use-sales-preview-href";
import { cn } from "@/lib/cn";
import { pageToolbarSizingClass, pageToolbarSurfaceClass } from "@/lib/ui/ontime-theme";
import { ZkWatchStatusGuideContent } from "./ZkWatchStatusGuideContent";

export function NotatnikGuide({ surface }: { surface: NotatnikSurface }) {
  const isZk = surface === "zk";
  const previewHref = useSalesPreviewHref();

  return (
    <HelpPopover
      label={isZk ? "Pomoc — ZK czekające" : "Pomoc — notatnik"}
      title={isZk ? "ZK czekające" : "Notatnik"}
      shortLabel="Pomoc"
      icon={<GuideIcon />}
      buttonClassName={cn(pageToolbarSurfaceClass, pageToolbarSizingClass, "px-2.5")}
    >
      {isZk ? (
        <>
          <HelpBlock title="Lista ZK">
            <p>
              <strong className="font-medium text-slate-800">Szukaj na swojej liście</strong>{" "}
              filtruje już dodane ZK (klient, numer, produkt).{" "}
              <strong className="font-medium text-slate-800">Dodaj nowe ZK</strong> pobiera
              dokument z Subiekta — to osobna akcja, nie filtr.
            </p>
          </HelpBlock>
          <HelpBlock title="Prośby i magazyn">
            <p>
              Z pozycji ZK możesz złożyć prośbę do zakupów. Gdy towar dotrze, status zmieni się na
              magazynie — śledzisz to tutaj i w{" "}
              <Link href={previewHref("/moje")} className="font-medium text-indigo-800 hover:underline">
                Moje zamówienia
              </Link>
              .
            </p>
          </HelpBlock>
          <HelpBlock title="Stany pozycji (regal → Moje → klient)">
            <ZkWatchStatusGuideContent compact />
          </HelpBlock>
        </>
      ) : (
        <>
          <HelpBlock title="Notatki prywatne">
            <p>
              Notatnik służy tylko Tobie — wpisy nie trafiają do działu zakupów. Możesz przypiąć
              ważne karteczki i ustawić przypomnienie.
            </p>
          </HelpBlock>
          <HelpBlock title="ZK vs notatnik">
            <p>
              Zamówienia klientów (ZK) są w zakładce{" "}
              <Link href={previewHref("/zk")} className="font-medium text-indigo-800 hover:underline">
                ZK czekające
              </Link>
              . Notatnik to osobna lista przypomnień.
            </p>
          </HelpBlock>
        </>
      )}
    </HelpPopover>
  );
}
