"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  IconCalendar,
  IconClipboardList,
  IconLayoutPanel,
} from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
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
    <Card className="mt-4 px-4 py-5 sm:px-6">
      <h3 className="text-sm font-semibold text-slate-900">Jak zacząć dzień w panelu?</h3>
      <ol className="mt-3 space-y-3">
        <GuideStep
          icon={<IconClipboardList size={15} />}
          tileClassName="bg-amber-100 text-amber-800"
          title="1. Prośby handlowców"
        >
          Oznacz Główne lub Uzupełniające — potem trafią do magazynu lub kolejki informacji.
        </GuideStep>
        <GuideStep
          icon={<IconLayoutPanel size={15} />}
          tileClassName="bg-sky-100 text-sky-800"
          title="2. Harmonogram na dziś"
        >
          Zaznacz dostawców jako zamówione po złożeniu zamówienia u dostawcy.
        </GuideStep>
        <GuideStep
          icon={<IconCalendar size={15} />}
          tileClassName={sectionIconTileBrandClass}
          title="3. Plan tygodnia"
        >
          Sprawdź terminy z wyprzedzeniem — kalendarz w zakładce Tydzień lub w Terminach zamówień.
        </GuideStep>
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={onOpenWeek}>
          Plan tygodnia
        </Button>
        <Link href="/lokalizacje/POLSKA">
          <Button size="sm" variant="outline">
            Terminy zamówień
          </Button>
        </Link>
        <Link href="/weryfikacja">
          <Button size="sm" variant="ghost">
            Weryfikacja
          </Button>
        </Link>
      </div>
    </Card>
  );
}
