"use client";

import type { ZdAutoProposalProsba } from "@/app/actions/zd-estimate";
import { IconChevronDown } from "@/components/icons/StrokeIcons";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { formatQty } from "@/lib/orders/zd-estimate-manual";

/** Prośby przy pozycjach propozycji: ładują się raz na propozycję (`id`), błąd zostaje przy liście. */
export type ZdProposalProsbyState =
  | { id: string; status: "ok"; byTwId: Record<string, ZdAutoProposalProsba[]>; truncated: boolean }
  | { id: string; status: "error"; message: string };

/** „Anna K., Jan N.” albo „3 handlowców” — kto czeka, w jednym kawałku linii. */
export function zdProsbaPeopleShort(requests: readonly ZdAutoProposalProsba[]): string {
  const names = [...new Set(requests.map((r) => r.salesPersonName.trim()).filter(Boolean))];
  if (names.length <= 2) return names.join(", ");
  return `${names.length} ${polishPluralWord(names.length, "handlowiec", "handlowców", "handlowców")}`;
}

/**
 * Przełącznik w linii pozycji: ile sztuk z tej pozycji jest na prośbę (z ilu w ZD, gdy pozycja jest w paczkach)
 * i kto prosi. Klik rozwija listę próśb pod pozycją.
 */
export function ZdProposalProsbaToggle({
  prosbaPieces,
  linePieces,
  packaged,
  requests,
  open,
  controls,
  onToggle,
}: {
  prosbaPieces: number;
  /** Sztuki tej pozycji przy bieżącej ilości (po poprawkach). */
  linePieces: number;
  /** Pozycja w paczkach — ilość ZD nie jest w sztukach, więc dopisujemy „z N szt”. */
  packaged: boolean;
  requests: readonly ZdAutoProposalProsba[] | null;
  open: boolean;
  controls: string;
  onToggle: () => void;
}) {
  const people = requests?.length ? zdProsbaPeopleShort(requests) : null;
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      title={people ? `Prośby: ${people}` : undefined}
      className="inline-flex min-h-8 min-w-0 max-w-full items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-900 transition-colors duration-150 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 max-sm:min-h-10"
    >
      <span className="whitespace-nowrap tabular-nums">
        na prośbę {formatQty(prosbaPieces)} szt{packaged ? ` z ${formatQty(Math.round(linePieces))}` : ""}
      </span>
      {people ? <span className="min-w-0 truncate font-normal text-emerald-800">· {people}</span> : null}
      <IconChevronDown open={open} size={13} className="shrink-0 duration-200 motion-reduce:transition-none" />
    </button>
  );
}

/** Lista próśb pod pozycją: handlowiec, ilość, klient, ZK i notatka — kto czeka na ten towar. */
export function ZdProposalProsbaList({
  id,
  state,
  requests,
  onRetry,
}: {
  id: string;
  /** null = jeszcze się wczytuje. */
  state: ZdProposalProsbyState | null;
  requests: readonly ZdAutoProposalProsba[];
  onRetry: () => void;
}) {
  return (
    <div id={id} className="zd-automat-detail-enter col-span-full rounded-md bg-emerald-50/60 px-3 py-2.5">
      {state == null ? (
        <p className="flex items-center gap-2 text-xs text-slate-600" role="status">
          <BrandLoader size="sm" tile={false} /> Wczytuję prośby handlowców…
        </p>
      ) : state.status === "error" ? (
        <p className="flex flex-wrap items-center gap-2 text-xs text-red-700" role="alert">
          {state.message}
          <button
            type="button"
            onClick={onRetry}
            className="font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
          >
            Spróbuj ponownie
          </button>
        </p>
      ) : requests.length === 0 ? (
        <p className="text-xs text-slate-600">
          Prośby z chwili przeliczenia nie są już otwarte - mogły zostać zamówione albo anulowane. Przelicz propozycję.
        </p>
      ) : (
        <>
          <ul className="space-y-2" aria-label="Prośby handlowców">
            {requests.map((r) => (
              <li key={r.orderId} className="text-xs leading-snug">
                <span className="font-medium text-slate-900">{r.salesPersonName}</span>
                <span className="tabular-nums text-slate-700"> · {formatQty(r.qty)} szt</span>
                {r.clientName || r.zkNumber ? (
                  <span className="block text-slate-600">
                    {[r.clientName ? `dla ${r.clientName}` : null, r.zkNumber].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
                {r.note ? <span className="block italic text-slate-600">„{r.note}”</span> : null}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Po utworzeniu ZD te prośby oznaczę jako zamówione (Główne).
            {state.truncated ? " Lista próśb dostawcy jest niepełna (limit) - całość w Kreatorze ZD." : ""}
          </p>
        </>
      )}
    </div>
  );
}
