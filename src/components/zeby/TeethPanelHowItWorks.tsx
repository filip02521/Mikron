import Link from "next/link";
import { HelpBlock } from "@/components/ui/HelpBlock";
import { TEETH_MARK_ORDERED_LABEL } from "@/components/zeby/teeth-panel-copy";
import { TEETH_PROCUREMENT_FLOW_STAGES } from "@/lib/teeth/teeth-procurement-flow-copy";
import { teethSupplierCardsHref } from "@/lib/teeth/teeth-supplier-dual-lane";

export function TeethPanelHowItWorksContent() {
  return (
    <>
      <HelpBlock title="Tor zębów — etapy">
        <ul className="list-disc space-y-1.5 pl-4">
          {TEETH_PROCUREMENT_FLOW_STAGES.map((step) => (
            <li key={step.stage}>
              <strong className="font-medium text-slate-800">{step.stage}</strong> —{" "}
              {step.where}
              <span className="text-slate-600"> ({step.detail})</span>
            </li>
          ))}
        </ul>
      </HelpBlock>

      <HelpBlock title="Ekrany menu (od najczęstszych)">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            <strong className="font-medium text-slate-800">Kolejka</strong> — prośby handlowców
            pogrupowane wg labu. Tu oznaczasz zamówienie i uzupełniasz listę zębów.
          </li>
          <li>
            <strong className="font-medium text-slate-800">Przyjęcie</strong> — porównujesz dostawę
            z zamówieniem u labu: wpisujesz co dotarło, a co nie (bez e-maila i regału).
          </li>
          <li>
            <strong className="font-medium text-slate-800">Historia</strong> — pozycje już
            zamówione u labu. ETA, audyt i korekty błędnego oznaczenia.
          </li>
          <li>
            <strong className="font-medium text-slate-800">Cykl zębów</strong> — ustawiasz w{" "}
            <Link href={teethSupplierCardsHref()} className="font-medium text-indigo-700 underline">
              kartach dostawców
            </Link>
            .
          </li>
        </ul>
      </HelpBlock>

      <HelpBlock title="Oznaczanie zamówienia">
        <p>
          Po kontakcie z dostawcą kliknij{" "}
          <strong className="font-medium text-slate-800">{TEETH_MARK_ORDERED_LABEL}</strong> — dla
          zaznaczonych prośb handlowców i/lub cyklu z harmonogramu.
        </p>
      </HelpBlock>

      <HelpBlock title="Lista zębów">
        <p>
          Przy pozycji wybierz <strong className="font-medium text-slate-800">Edytuj listę</strong>,
          uzupełnij szczękę, typ i pozycje. Kompletna lista jest wymagana przed oznaczeniem jako
          zamówione.
        </p>
      </HelpBlock>

      <HelpBlock title="Odświeżanie">
        <p>
          Panel sprawdza kolejkę co ok. 25 s. Gdy pojawią się nowe pozycje, w stopce zobaczysz link{" "}
          <strong className="font-medium text-slate-800">odśwież widok</strong>.
        </p>
      </HelpBlock>
    </>
  );
}
