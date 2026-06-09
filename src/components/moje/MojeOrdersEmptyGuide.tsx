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
import { MY_ORDER_ACTION_SECTION_COPY } from "@/lib/orders/my-order-inbox-sections";

function GuidePoint({
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

function GuideContent({ showActions = true }: { showActions?: boolean }) {
  return (
    <>
      <h3 className="text-sm font-semibold text-slate-900">Jak działa ta zakładka?</h3>
      <ul className="mt-3 space-y-3">
        <GuidePoint
          icon={<IconPlusCircle size={15} />}
          tileClassName={sectionIconTileBrandClass}
          title="Zgłoś prośbę"
        >
          Po złożeniu prośby w formularzu Zgłoś prośbę status i kolejne kroki zobaczysz tutaj.
        </GuidePoint>
        <GuidePoint
          icon={<IconPackageCheck size={15} />}
          tileClassName="bg-emerald-100 text-emerald-800"
          title={MY_ORDER_ACTION_SECTION_COPY.title}
        >
          {MY_ORDER_ACTION_SECTION_COPY.hint}
        </GuidePoint>
        <GuidePoint
          icon={<IconMail size={15} />}
          tileClassName="bg-slate-100 text-slate-600"
          title="E-mail"
        >
          O ważnych zmianach dostaniesz też wiadomość e-mail — na co dzień sprawdzaj listę w
          aplikacji.
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
    </>
  );
}

/** Onboarding przy pustej skrzynce. */
export function MojeOrdersEmptyGuide({
  showActions = true,
  embedded = false,
}: {
  showActions?: boolean;
  embedded?: boolean;
}) {
  if (embedded) {
    return (
      <div className="relative overflow-hidden rounded-md border border-slate-200/80 bg-slate-50/50 px-4 py-4">
        <BrandCardAccent className="absolute -right-6 -top-6 h-24 w-32 opacity-80" />
        <div className="relative z-[1]">
          <GuideContent showActions={showActions} />
        </div>
      </div>
    );
  }

  return (
    <Card className="relative overflow-hidden px-4 py-5 sm:px-6">
      <BrandCardAccent className="absolute -right-6 -top-6 h-28 w-36 opacity-90" />
      <div className="relative z-[1]">
        <GuideContent showActions={showActions} />
      </div>
    </Card>
  );
}
