"use client";

import { HelpPopover } from "@/components/ui/HelpPopover";

export function MojeOrdersGuide({ pickupCount }: { pickupCount: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">Co znajdziesz na tej stronie</p>
        <HelpPopover label="Szczegóły" title="Moje zamówienia" shortLabel="Więcej">
          <p className="mb-2">
            <strong className="font-medium text-slate-800">Zamówienia u dostawcy</strong> — dział
            dostaw składa zamówienie; widzisz postęp na magazynie i szacowany termin.
          </p>
          <p className="mb-2">
            <strong className="font-medium text-slate-800">Informacja o dostępności</strong> — bez
            zamawiania; dostaniesz e-mail, gdy towar pojawi się u nas.
          </p>
          <p className="mb-2">
            <strong className="font-medium text-slate-800">Zielony pasek</strong> — towar gotowy;
            potwierdź odbiór, gdy go odbierzesz z magazynu (wpis zniknie z listy).
          </p>
          <p>
            W rozwiniętej karcie: lista produktów,{" "}
            <strong className="font-medium text-slate-800">Popraw prośbę</strong>,{" "}
            <strong className="font-medium text-slate-800">Wycofaj</strong> (gdy jeszcze można).
            Na dole — archiwum odebranych i zakończonych.
          </p>
        </HelpPopover>
      </div>

      <ul className="mt-3 space-y-2 text-sm text-slate-700">
        <li className="flex gap-2">
          <span className="mt-0.5 shrink-0 font-bold text-emerald-600" aria-hidden>
            ●
          </span>
          <span>
            <strong className="font-medium text-slate-900">Odbiór</strong> — zielony pasek na karcie;
            przycisk „Potwierdzam odbiór”, gdy masz towar z magazynu.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="mt-0.5 shrink-0 font-bold text-indigo-500" aria-hidden>
            ●
          </span>
          <span>
            <strong className="font-medium text-slate-900">W toku</strong> — czekamy na dostawcę lub
            uzupełniamy dane; szacunek terminu pod kartą, gdy jest dostępny.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="mt-0.5 shrink-0 font-bold text-slate-400" aria-hidden>
            ●
          </span>
          <span>
            <strong className="font-medium text-slate-900">Szczegóły</strong> — kliknij kartę (strzałka):
            produkty, klient, poprawa lub wycofanie prośby.
          </span>
        </li>
      </ul>

      {pickupCount > 0 ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
          Teraz do odbioru:{" "}
          {pickupCount === 1
            ? "1 dostawa — potwierdź odbiór po zabraniu towaru."
            : `${pickupCount} dostaw — użyj filtra „Odbiór” u góry listy.`}
        </p>
      ) : null}
    </div>
  );
}
