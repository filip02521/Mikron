import { HelpBlock } from "@/components/ui/HelpBlock";
import { TEETH_MARK_ORDERED_LABEL } from "@/components/zeby/teeth-panel-copy";

export function TeethPanelHowItWorksContent() {
  return (
    <>
      <HelpBlock title="Zakładki">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            <strong className="font-medium text-slate-800">Kolejka</strong> — prośby handlowców
            pogrupowane wg dostawcy. Tu oznaczasz zamówienie u dostawcy i uzupełniasz listę zębów.
          </li>
          <li>
            <strong className="font-medium text-slate-800">Historia</strong> — pozycje już
            zamówione. Możesz cofnąć błędne oznaczenie lub skorygować datę dostawy.
          </li>
          <li>
            <strong className="font-medium text-slate-800">Harmonogram</strong> — cykl zamówień u
            dostawców i liczba prośb czekających u każdego.
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
