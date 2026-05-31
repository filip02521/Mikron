"use client";

import { BrandCardAccent } from "@/components/brand/BrandCardAccent";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { buttonPrimaryClass } from "@/lib/ui/ontime-theme";
import {
  IconClipboardList,
  IconMail,
  IconPackageCheck,
  IconPlusCircle,
} from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { sectionIconTileBrandClass } from "@/lib/ui/ontime-theme";

function GuidePoint({
  icon,
  tileClassName,
  children,
}: {
  icon: React.ReactNode;
  tileClassName: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3 text-sm leading-relaxed text-slate-600">
      <SectionHeadingIcon tileClassName={tileClassName} className="mt-0.5 h-7 w-7">
        {icon}
      </SectionHeadingIcon>
      <span className="min-w-0 pt-0.5">{children}</span>
    </li>
  );
}

/** Onboarding przy pustej skrzynce — punkty 5 z planu UX. */
export function MojeOrdersEmptyGuide({ showActions = true }: { showActions?: boolean }) {
  return (
    <Card className="relative overflow-hidden px-4 py-5 sm:px-6">
      <BrandCardAccent className="absolute -right-6 -top-6 h-28 w-36 opacity-90" />
      <div className="relative z-[1]">
      <h3 className="text-sm font-semibold text-slate-900">Jak działa ta zakładka?</h3>
      <ul className="mt-3 space-y-3">
        <GuidePoint
          icon={<IconPlusCircle size={15} />}
          tileClassName={sectionIconTileBrandClass}
        >
          Po zgłoszeniu prośby w <strong className="font-medium text-slate-800">Zgłoś prośbę</strong>{" "}
          zobaczysz tutaj status i kolejne kroki.
        </GuidePoint>
        <GuidePoint
          icon={<IconPackageCheck size={15} />}
          tileClassName="bg-emerald-100 text-emerald-800"
        >
          <strong className="font-medium text-slate-800">Zielony przycisk</strong> oznacza odbiór z
          magazynu — potwierdź, gdy odbierzesz towar (lub gdy chcesz zamknąć powiadomienie o
          dostępności).
        </GuidePoint>
        <GuidePoint icon={<IconMail size={15} />} tileClassName="bg-slate-100 text-slate-600">
          O ważnych zmianach dostaniesz też e-mail — lista tutaj jest na co dzień w aplikacji.
        </GuidePoint>
      </ul>
      {showActions ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href="/prosba"
            className={cn(
              buttonPrimaryClass,
              "inline-flex min-h-11 items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium"
            )}
          >
            <IconPlusCircle size={16} className="text-white" />
            Zgłoś prośbę
          </Link>
          <Link
            href="/plan"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <IconClipboardList size={16} />
            Plan dostaw
          </Link>
        </div>
      ) : null}
      </div>
    </Card>
  );
}
