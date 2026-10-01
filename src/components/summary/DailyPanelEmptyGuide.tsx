"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BrandCardAccent } from "@/components/brand/BrandCardAccent";
import {
  IconCalendar,
  IconClipboardList,
  IconLayoutPanel,
} from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { sectionIconTileBrandClass } from "@/lib/ui/ontime-theme";

function GuideStep({
  icon,
  tileClassName,
  title,
  children,
}: {
  icon: React.ReactNode;
  tileClassName: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3 text-sm leading-relaxed text-slate-600">
      <SectionHeadingIcon tileClassName={tileClassName} className="mt-0.5 h-7 w-7 shrink-0">
        {icon}
      </SectionHeadingIcon>
      <div className="min-w-0 pt-0.5">
        <p className="font-medium text-slate-800">{title}</p>
        <p className="mt-0.5">{children}</p>
      </div>
    </li>
  );
}

/** Krótka ścieżka „od czego zacząć” przy pustym panelu Dziś. */
export function DailyPanelEmptyGuide({ onOpenWeek }: { onOpenWeek: () => void }) {
  return (
    <Card className="relative mt-4 overflow-hidden px-4 py-5 sm:px-6">
      <BrandCardAccent className="pointer-events-none absolute -right-6 -top-6 h-28 w-36 opacity-90" />
      <div className="relative z-[1]">
        <h3 className="text-sm font-semibold text-slate-900">Od czego zacząć?</h3>
        <ol className="mt-3 space-y-3">
          <GuideStep
            icon={<IconClipboardList size={15} />}
            tileClassName="bg-amber-100 text-amber-800"
            title="1. Prośby handlowców"
          >
            Oznacz Główne albo Uzupełniające — prośba trafi do magazynu lub kolejki informacji.
          </GuideStep>
          <GuideStep
            icon={<IconLayoutPanel size={15} />}
            tileClassName="bg-sky-100 text-sky-800"
            title="2. Harmonogram na dziś"
          >
            Po złożeniu zamówienia u dostawcy zaznacz Zamówione.
          </GuideStep>
          <GuideStep
            icon={<IconCalendar size={15} />}
            tileClassName={sectionIconTileBrandClass}
            title="3. Plan tygodnia"
          >
            Sprawdź terminy z wyprzedzeniem — w zakładce Tydzień albo w Terminach zamówień.
          </GuideStep>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={onOpenWeek}>
            Plan tygodnia
          </Button>
          <Link href="/lokalizacje/POLSKA">
            <Button size="sm" variant="outline" className="inline-flex items-center gap-1">
              Terminy zamówień
              <LinkChevron size={13} tone="brand" />
            </Button>
          </Link>
          <Link href="/weryfikacja">
            <Button size="sm" variant="ghost" className="inline-flex items-center gap-1">
              Weryfikacja
              <LinkChevron size={13} tone="muted" />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
