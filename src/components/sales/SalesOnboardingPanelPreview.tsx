"use client";

import { FlowChevron } from "@/components/ui/UiGlyphs";
import { cn } from "@/lib/cn";
import type { SalesOnboardingStep } from "@/lib/sales/sales-onboarding-steps";
import { NavIcon, navIconTileIdleClass } from "@/components/icons/NavIcon";

function PreviewRow({
  title,
  badge,
  badgeClass,
  action,
}: {
  title: string;
  badge: string;
  badgeClass: string;
  action?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200/90 bg-white px-2.5 py-2 shadow-sm">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-900">{title}</p>
        <span
          className={cn(
            "mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold",
            badgeClass
          )}
        >
          {badge}
        </span>
      </div>
      {action ? (
        <span className="shrink-0 rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white">
          {action}
        </span>
      ) : null}
    </div>
  );
}

export function SalesOnboardingPanelPreview({ stepId }: { stepId: string }) {
  switch (stepId) {
    case "welcome":
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-sky-600 text-lg font-bold text-white shadow-md">
            OT
          </div>
          <p className="text-xs text-slate-500">OnTime · handlowiec ↔ zakupy ↔ magazyn</p>
        </div>
      );
    case "moje":
      return (
        <div className="space-y-2">
          <PreviewRow
            title="Dentsply · 1 produkt"
            badge="Czekamy u dostawcy"
            badgeClass="bg-slate-100 text-slate-700"
          />
          <PreviewRow
            title="Ivoclar · informacja"
            badge="Tylko dostępność"
            badgeClass="bg-violet-100 text-violet-800"
          />
          <PreviewRow
            title="Graphenano Dental · 2 produkty"
            badge="Odbiór z magazynu"
            badgeClass="bg-emerald-100 text-emerald-800"
            action="Potwierdź"
          />
          <div className="rounded-md border border-slate-200/90 bg-slate-50 px-2.5 py-2 text-[10px] text-slate-600">
            Ostatnio zakończone · 2 wpisy (np. odebrane, potwierdzone informacje)
          </div>
        </div>
      );
    case "prosba":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border-2 border-indigo-400 bg-indigo-50 px-2 py-2 text-center text-[11px] font-semibold text-indigo-900">
              Zamówienie u dostawcy
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-2 py-2 text-center text-[11px] font-medium text-slate-600">
              Tylko dostępność
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-700">
              <span className="font-medium text-slate-900">Straumann · implant</span>
              <span className="inline-flex items-center gap-0.5 text-slate-500">
                <FlowChevron size={10} className="text-slate-300" />
                Straumann
              </span>
              <p className="mt-1 text-[10px] text-indigo-800/90">Klient: Klinika Smile</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-700">
              <span className="font-medium text-slate-900">Ivoclar · cement</span>
              <span className="inline-flex items-center gap-0.5 text-slate-500">
                <FlowChevron size={10} className="text-slate-300" />
                Ivoclar
              </span>
              <p className="mt-1 text-[10px] text-indigo-800/90">Klient: Serwis AutoMax</p>
            </div>
          </div>
          <p className="text-center text-[10px] font-medium text-indigo-700">+ Kolejny produkt</p>
        </div>
      );
    case "plan":
      return (
        <div className="space-y-2">
          <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-500">
            Szukaj dostawcy…
          </div>
          {["Dental Supply PL · 2 prośby", "Import Medica · 1 prośba"].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]"
            >
              <span className="font-medium text-slate-800">{row}</span>
              <span className="text-indigo-600">rozwiń</span>
            </div>
          ))}
        </div>
      );
    case "tablica":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border-2 border-sky-400 bg-sky-50 px-2 py-1.5 text-center text-[10px] font-semibold text-sky-900">
              Ogłoszenia · 1 nowe
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-center text-[10px] font-medium text-slate-600">
              Pytania
            </div>
          </div>
          <div className="rounded-md border border-sky-200 bg-sky-50/80 px-2.5 py-2 text-[11px] text-sky-950">
            <p className="font-semibold">Nowa procedura zamówień importowych</p>
            <p className="mt-0.5 text-[10px] text-sky-900/90">Od zakupów · tylko do odczytu</p>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-950">
            <p className="font-semibold">Pytanie: próbki implantów poza harmonogramem?</p>
            <p className="mt-0.5 text-[10px] text-emerald-800">Odpowiedź zakupów · widoczna dla wszystkich</p>
          </div>
        </div>
      );
    case "notatnik":
      return (
        <div className="space-y-2">
          <div className="rounded-md border border-violet-200 bg-violet-50/80 px-2.5 py-1.5 text-[10px] text-violet-900">
            Do zrobienia dziś · przypomnienie przy ZK
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-950">
            <p className="font-semibold">ZK/2026/0138 · Gabinet Dr Kowalski</p>
            <p className="mt-0.5 text-[10px] font-medium text-amber-800">Czeka na towar</p>
            <p className="mt-1 text-[10px] text-amber-900/90">Skaler UDS · końcówki</p>
            <span className="mt-1.5 inline-block rounded bg-indigo-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
              Zgłoś prośbę
            </span>
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-700">
            Notatki · oddzwonić do kliniki w piątek
          </div>
        </div>
      );
    case "zespol":
      return (
        <div className="space-y-2">
          {["Anna K. · 2 ZK na towar", "Piotr M. · 1 przypomnienie", "Sklep · 5 prośb"].map((row) => (
            <div
              key={row}
              className="rounded-md border border-indigo-100 bg-indigo-50/50 px-2.5 py-1.5 text-[11px] font-medium text-slate-800"
            >
              {row}
            </div>
          ))}
        </div>
      );
    case "finish":
      return (
        <div className="flex flex-col items-center gap-2 py-3 text-center">
          <p className="text-sm font-semibold text-indigo-900">Wszystko jasne?</p>
          <p className="text-xs text-slate-500">
            Za chwilę zobaczysz swoje dane — kliknij „Zakończ tour”, aby wejść do panelu.
          </p>
        </div>
      );
    default:
      return null;
  }
}

export function SalesOnboardingStepHeader({
  step,
  compact = false,
}: {
  step: SalesOnboardingStep;
  compact?: boolean;
}) {
  if (!step.navKey) return null;
  return (
    <div className={cn("flex items-center gap-2.5", compact ? "mb-1" : "mb-4")}>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg",
          compact ? "h-9 w-9" : "h-11 w-11",
          navIconTileIdleClass(step.navKey)
        )}
      >
        <NavIcon navKey={step.navKey} size={compact ? 18 : 22} />
      </div>
      {step.href ? (
        <p className="text-[11px] font-medium text-indigo-700/80 md:text-xs">
          Zakładka: <span className="text-indigo-900">{step.href}</span>
        </p>
      ) : null}
    </div>
  );
}
