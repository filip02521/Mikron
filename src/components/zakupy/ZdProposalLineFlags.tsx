import { IconAlertCircle } from "@/components/icons/StrokeIcons";
import { Badge } from "@/components/ui/Badge";
import { HelpHintBubble } from "@/components/ui/HelpHintBubble";
import type { ZdAutoProposal } from "@/lib/data/zd-auto-proposals";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { ZD_PROPOSAL_LINE_FLAG_LABEL, type ZdProposalLineFlag } from "@/lib/orders/zd-automat-contract";

/** Krótko, dlaczego bezpiecznik oznaczył linię (progi z `zd-proposal-guards.ts`). */
export const ZD_PROPOSAL_LINE_FLAG_WHY: Record<ZdProposalLineFlag, string> = {
  ceiling: "Stan, otwarte ZD i to zamówienie dają więcej niż tempo sprzedaży × (dni celu + 30 dni) — o więcej niż jedną sztukę albo paczkę.",
  peak: "Jeden dokument to ponad 60% sprzedaży z 30 dni, a ilość przekracza 2× tempo z 90 dni × dni celu (tylko towary, które sprzedały w 30 dni co najmniej 5 szt, pozycje od 200 zł).",
  jump: "Ilość ponad 3× średnia z 4 ostatnich ZD tego towaru u dostawcy.",
  new_item: "Pierwsza sprzedaż mniej niż 13 tygodni temu, a pozycja jest warta ponad 500 zł.",
  missing_data: "Brak tempa sprzedaży, ceny albo czasu dostawy - ilości nie dało się sprawdzić.",
  habit: "Przy 3 z 4 ostatnich ZD poprawiałeś tę linię w tę samą stronę - ilość liczona z Twojego wzorca (albo linia zwykle zdejmowana).",
};

/**
 * Bezpieczniki linii propozycji (zadanie 4): odznaki i dymek z powodem — z liczbami linii, gdy są
 * `notes` (propozycje sprzed notatek: sama reguła). Linia nie jest blokowana.
 */
export function ZdProposalLineFlags({
  flags,
  notes,
}: {
  flags?: ZdProposalLineFlag[];
  notes?: Partial<Record<ZdProposalLineFlag, string>>;
}) {
  if (!flags?.length) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {flags.map((f) => (
        <Badge key={f} variant="warning">
          {ZD_PROPOSAL_LINE_FLAG_LABEL[f]}
        </Badge>
      ))}
      <HelpHintBubble
        tone="warning"
        ariaLabel="Dlaczego do sprawdzenia"
        message={flags.map((f) => `${ZD_PROPOSAL_LINE_FLAG_LABEL[f]}: ${notes?.[f] ?? ZD_PROPOSAL_LINE_FLAG_WHY[f]}`).join(" ")}
      />
    </span>
  );
}

/** Podsumowanie bezpieczników nad listą: ile pozycji do sprawdzenia i nietypowa wartość całego ZD. */
export function ZdProposalFlagsSummary({ proposal }: { proposal: Pick<ZdAutoProposal, "lines" | "flags"> }) {
  const flagged = proposal.lines.filter((l) => l.flags?.length).length;
  const valueJump = proposal.flags.includes("order_value_jump");
  if (!flagged && !valueJump) return null;
  return (
    <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
      <IconAlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1">
        {flagged ? (
          <p>
            <span className="font-semibold">
              {flagged} {polishPluralWord(flagged, "pozycja", "pozycje", "pozycji")} do sprawdzenia
            </span>{" "}
            - {polishPluralWord(flagged, "oznaczona", "oznaczone", "oznaczonych")} na górze listy. Sprawdź ilość przed zatwierdzeniem.
          </p>
        ) : null}
        {valueJump ? (
          <p>
            <span className="font-semibold">Wartość ZD ponad 2× większa niż zwykle</span> (mediana 6 ostatnich ZD
            dostawcy, od 2000 zł) - sprawdź całe zamówienie.
          </p>
        ) : null}
      </div>
    </div>
  );
}
