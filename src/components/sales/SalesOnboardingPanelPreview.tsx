"use client";

import { FlowChevron } from "@/components/ui/UiGlyphs";
import { cn } from "@/lib/cn";
import type { SalesOnboardingStep } from "@/lib/sales/sales-onboarding-steps";
import {
  INFORMACJA_FLOW_DIRECT,
  INFORMACJA_FLOW_STOCK_OUT,
} from "@/lib/orders/informacja-flow-copy";
import { NavIcon, navIconTileIdleClass } from "@/components/icons/NavIcon";

function PreviewRow({
  title,
  badge,
  badgeClass,
  action,
  accent = "border-l-slate-200",
}: {
  title: string;
  badge: string;
  badgeClass: string;
  action?: string;
  accent?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-b border-slate-100 bg-white px-2.5 py-2 last:border-b-0",
        "border-l-[3px]",
        accent
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              badgeClass
            )}
          >
            {badge}
          </span>
          <p className="truncate text-xs font-semibold text-slate-900">{title}</p>
        </div>
      </div>
      {action ? (
        <span className="shrink-0 rounded-md border border-indigo-200 bg-white px-2 py-1 text-[10px] font-semibold text-indigo-800 shadow-sm">
          {action}
        </span>
      ) : null}
    </div>
  );
}

function WelcomeChannelChip({
  label,
  hint,
  tone,
}: {
  label: string;
  hint: string;
  tone: "indigo" | "sky" | "violet" | "slate";
}) {
  const toneClass =
    tone === "indigo"
      ? "border-indigo-200 bg-indigo-50/80 text-indigo-950"
      : tone === "sky"
        ? "border-sky-200 bg-sky-50/80 text-sky-950"
        : tone === "violet"
          ? "border-violet-200 bg-violet-50/80 text-violet-950"
          : "border-slate-200 bg-slate-50/80 text-slate-800";

  return (
    <div className={cn("rounded-md border px-2.5 py-2 text-left", toneClass)}>
      <p className="text-[11px] font-semibold">{label}</p>
      <p className="mt-0.5 text-[10px] leading-snug opacity-90">{hint}</p>
    </div>
  );
}

export function SalesOnboardingPanelPreview({ stepId }: { stepId: string }) {
  switch (stepId) {
    case "welcome":
      return (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <WelcomeChannelChip
              label="Moje zamówienia"
              hint="Statusy i odbiór z magazynu"
              tone="indigo"
            />
            <WelcomeChannelChip
              label="Nowa prośba"
              hint="Formalne zgłoszenie do zakupów"
              tone="indigo"
            />
            <WelcomeChannelChip
              label="Harmonogram"
              hint="Terminy u dostawców"
              tone="sky"
            />
            <WelcomeChannelChip
              label="Tablica"
              hint="Ogłoszenia zakupów · pytania zespołu"
              tone="sky"
            />
            <WelcomeChannelChip
              label="ZK czekające"
              hint="ZK z Subiekta — prośby i magazyn"
              tone="violet"
            />
            <WelcomeChannelChip
              label="Notatnik"
              hint="Prywatne przypomnienia — nie do zakupów"
              tone="violet"
            />
          </div>
          <div className="rounded-md border border-violet-100 bg-violet-50/60 px-2.5 py-2 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">
              Informacja o towarze — dwa warianty
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-violet-950/90">
              <span className="font-medium">{INFORMACJA_FLOW_DIRECT.label}</span> → e-mail + wpis
              w „Moje zamówienia”.{" "}
              <span className="font-medium">{INFORMACJA_FLOW_STOCK_OUT.label}</span> → tylko sygnał
              dla zakupów.
            </p>
          </div>
        </div>
      );
    case "moje":
      return (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-md border border-slate-200/90 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-2.5 py-2 text-[10px] font-semibold text-slate-700">
              Start dnia · pilne sprawy na dziś
            </div>
            <PreviewRow
              title="Potwierdź odbiór z regału (2)"
              badge="Gotowe"
              badgeClass="bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
              action="Przejdź"
              accent="border-l-emerald-500"
            />
            <PreviewRow
              title="Potwierdź informacje o dotarciu (1)"
              badge="Do potwierdzenia"
              badgeClass="bg-violet-50 text-violet-800 ring-1 ring-violet-100"
              action="Przejdź"
              accent="border-l-violet-400"
            />
          </div>
          <div className="rounded-md border border-slate-200/90 bg-slate-50 px-2.5 py-2 text-[10px] text-slate-600">
            Archiwum · zakończone sprawy
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
              Informacja o towarze
            </div>
          </div>
          <div className="rounded-md border border-violet-100 bg-violet-50/70 px-2 py-1.5 text-[10px] text-violet-900">
            {INFORMACJA_FLOW_DIRECT.label} · e-mail + Moje
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
              <p className="mt-1 text-[10px] text-indigo-800/90">Klient: Gabinet Dr Kowalski</p>
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
          {["Straumann · 2 prośby", "Dentsply · 1 prośba"].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]"
            >
              <span className="font-medium text-slate-800">{row}</span>
              <span className="text-indigo-600">rozwiń</span>
            </div>
          ))}
          <div className="rounded-md border border-sky-100 bg-sky-50/70 px-2.5 py-1.5 text-[10px] text-sky-900">
            Plan działu dostaw · pn.–pt. · kiedy składamy zamówienia u dostawców
          </div>
        </div>
      );
    case "tablica":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border-2 border-sky-400 bg-sky-50 px-2 py-1.5 text-center text-[10px] font-semibold text-sky-900">
              Ogłoszenia od zakupów
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-center text-[10px] font-medium text-slate-600">
              Pytania zespołu
            </div>
          </div>
          <div className="rounded-md border border-sky-200 bg-sky-50/80 px-2.5 py-2 text-[11px] text-sky-950">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-800">Ogłoszenie</p>
            <p className="mt-0.5 font-semibold">Zamówienia importowe — podaj kod Mikran</p>
          </div>
          <p className="text-center text-[10px] text-slate-500">
            Przełącz zakładkę, aby zobaczyć pytania zespołu
          </p>
        </div>
      );
    case "notatnik":
      return (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1 rounded-md border-2 border-indigo-400 bg-indigo-50 px-2 py-1.5 text-center text-[10px] font-semibold text-indigo-900">
              ZK
            </div>
            <div className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-center text-[10px] font-medium text-slate-600">
              Archiwum
            </div>
          </div>
          <div className="rounded-md border border-violet-200 bg-violet-50/80 px-2.5 py-1.5 text-[10px] text-violet-900">
            Do zrobienia dziś · przypomnienie ZK
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-950">
            <p className="font-semibold">ZK/2026/0138 · Gabinet Dr Kowalski</p>
            <p className="mt-0.5 text-[10px] font-medium text-amber-800">Czeka na towar</p>
            <span className="mt-1.5 inline-block rounded bg-indigo-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
              Zgłoś prośbę
            </span>
          </div>
        </div>
      );
    case "notatnik-notes":
      return (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1 rounded-md border-2 border-indigo-400 bg-indigo-50 px-2 py-1.5 text-center text-[10px] font-semibold text-indigo-900">
              Notatki
            </div>
            <div className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-center text-[10px] font-medium text-slate-600">
              Archiwum
            </div>
          </div>
          <div className="rounded-md border border-violet-200 bg-violet-50/80 px-2.5 py-1.5 text-[10px] text-violet-900">
            Do zrobienia dziś · notatka z przypomnieniem
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-700">
            Oddzwonić do gabinetu — potwierdzić termin
          </div>
        </div>
      );
    case "zespol":
      return (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500">Przykładowy układ zespołu</p>
          {["Anna K. · 2 ZK na towar", "Piotr M. · 1 przypomnienie", "Sklep · 5 prośb"].map(
            (row) => (
              <div
                key={row}
                className="rounded-md border border-indigo-100 bg-indigo-50/50 px-2.5 py-1.5 text-[11px] font-medium text-slate-800"
              >
                {row}
              </div>
            )
          )}
        </div>
      );
    case "finish":
      return (
        <div className="flex flex-col items-center gap-2 py-3 text-center">
          <p className="text-sm font-semibold text-indigo-900">Wszystko jasne?</p>
          <p className="text-xs text-slate-500">
            Kliknij „Zakończ tour”, aby wejść do panelu ze swoimi danymi.
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
  const label = step.navLabel ?? step.title;
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
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-indigo-700/80 md:text-xs">Zakładka</p>
        <p className="truncate text-xs font-semibold text-indigo-950 md:text-sm">{label}</p>
      </div>
    </div>
  );
}
