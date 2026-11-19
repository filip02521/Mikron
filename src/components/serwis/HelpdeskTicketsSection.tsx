"use client";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import type { HelpdeskTicket } from "@/lib/mikran-shop/helpdesk-parse";
import type { HelpdeskLinkedOrder } from "@/lib/data/service-orders";
import { toDateOnly } from "@/lib/orders/service-loaners";
import { formatAutomatDay } from "@/lib/orders/zd-automat-daily";
import { countTicketsWithoutOrders, sortTicketsForIntake } from "@/components/serwis/helpdesk-intake";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { IconPackage, IconTruck } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { rubricLabelClass } from "@/lib/ui/serwis-theme";

export type HelpdeskBoardData = {
  mode: "live" | "test" | "off";
  /** Otwarte zgłoszenia serwisanta (z helpdesku), także te, z których przyjęto już część sprzętu. */
  tickets: HelpdeskTicket[];
  /** Zlecenia założone z danego zgłoszenia: numer zgłoszenia → zlecenia (jedno zgłoszenie bywa na kilka urządzeń). */
  linked: Record<number, HelpdeskLinkedOrder[]>;
  error: string | null;
  /** Połączenie z mikran.pl wygasło albo zostało cofnięte — pomoże tylko ponowne logowanie. */
  needsReconnect?: boolean;
  /** Serwisant może odpowiadać klientowi z OnTime (MIKRAN_HELPDESK_WRITE=1 i połączony helpdesk). */
  canReply?: boolean;
};

const CONNECT_HREF = "/api/mcp/connect";

/** Zwykły link (nie fetch): przeglądarka idzie na stronę logowania mikran.pl i wraca do zleceń. */
function ConnectLink({ label }: { label: string }) {
  return (
    <a href={CONNECT_HREF} className={buttonClass("primary", "sm", "mt-2.5")}>
      {label}
    </a>
  );
}

/** Sposób dostarczenia ze zgłoszenia — te same słowa w kolumnie „Dostarczenie” i przy wyborze zgłoszenia w przyjęciu. */
export const DELIVERY_LABEL: Record<number, string> = { 1: "Wysyła klient", 2: "Odbiór Mikran" };
const DELIVERY_SHORT = DELIVERY_LABEL;
/** Te same kolumny w nagłówku i w wierszach: na telefonie dwie (opis, akcja), od sm cztery. */
const ROW_GRID = "grid gap-x-3 px-4 sm:grid-cols-[minmax(0,1fr)_8rem_9.5rem_6.5rem] sm:gap-x-5 sm:px-5";

/** Zgłoszenia z helpdesku mikran.pl, które czekają na sprzęt — każde przyjmuje się jednym kliknięciem. */
export function HelpdeskTicketsSection({
  data,
  tickets,
  onAccept,
  canConnect = false,
}: {
  data: HelpdeskBoardData;
  /** Zgłoszenia po filtrze szukania. */
  tickets: HelpdeskTicket[];
  /** Bez niego (podgląd tylko do odczytu) wiersze nie mają przycisku przyjęcia. */
  onAccept?: (helpdeskId: number) => void;
  /** Serwisant łączy helpdesk sam, swoim kontem mikran.pl (w podglądzie admina — nie). */
  canConnect?: boolean;
}) {
  const todayKey = toDateOnly(new Date());
  // Bez połączenia: na produkcji pusto („off”), poza nią dane testowe („test”) — w obu serwisant widzi, jak połączyć.
  const notConnected =
    data.mode === "live" ? null : (
      <Alert tone="info" title="Helpdesk mikran.pl nie jest połączony">
        <p className="text-sm">
          {canConnect
            ? "Zaloguj się swoim kontem mikran.pl (login, hasło, kod z Authenticatora) — Twoje zgłoszenia pojawią się tutaj."
            : "Zgłoszenia ze sklepu pojawią się tutaj, gdy serwisant połączy helpdesk swoim kontem mikran.pl."}
          {data.mode === "test" ? " Do tego czasu poniżej dane testowe." : canConnect ? " Sprzęt bez zgłoszenia przyjmiesz przyciskiem „Przyjmij sprzęt”." : ""}
        </p>
        {canConnect ? <ConnectLink label="Połącz z helpdeskiem" /> : null}
      </Alert>
    );
  if (data.mode === "off") return notConnected;
  if (data.error && data.needsReconnect) {
    return (
      <Alert tone="warning" title="Połącz helpdesk mikran.pl ponownie">
        <p className="text-sm">
          {canConnect
            ? `${data.error} Zaloguj się jeszcze raz swoim kontem mikran.pl. Zlecenia poniżej są aktualne.`
            : `${data.error} Połączenie odnawia serwisant swoim kontem mikran.pl.`}
        </p>
        {canConnect ? <ConnectLink label="Połącz ponownie" /> : null}
      </Alert>
    );
  }
  if (data.error) {
    return (
      <Alert tone="warning" title="Nie pobrano zgłoszeń z helpdesku">
        {`${data.error} Zlecenia poniżej są aktualne; sprzęt ze zgłoszenia przyjmiesz też w „Przyjmij sprzęt” — po numerze albo szukaniem w całym helpdesku.`}
      </Alert>
    );
  }
  // Na liście tylko zgłoszenia bez żadnego przyjętego sprzętu: OnTime nie wie, ile urządzeń obejmuje zgłoszenie,
  // więc to z przyjętym zleceniem nie wisi tu dalej — kolejny sprzęt z niego wybiera się w oknie przyjęcia (lista + szukanie).
  const waitingTickets = sortTicketsForIntake(tickets, data.linked).filter((t) => !(data.linked[t.id]?.length));
  const withOrders = tickets.length - countTicketsWithoutOrders(tickets, data.linked);
  if (!waitingTickets.length) return notConnected;
  return (
    <>
    {notConnected}
    <section aria-labelledby="grp-helpdesk" className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--sv-rule)] bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--sv-rule)] px-4 py-3 sm:px-5">
        <h2 id="grp-helpdesk" className="text-[0.9375rem] font-semibold text-slate-900">
          Do przyjęcia z helpdesku <span className="font-normal text-slate-500">· {waitingTickets.length}</span>
        </h2>
        {data.mode === "test" ? <Badge variant="warning">Dane testowe</Badge> : null}
      </div>
      {/* Każdy fakt w swojej kolumnie (od sm): sprzęt i klient · zgłoszenie · dostarczenie · akcja; na telefonie fakty pod nazwą. */}
      <div aria-hidden className={cn(ROW_GRID, "hidden border-b border-[var(--sv-rule)] bg-[var(--sv-box)] py-2 sm:grid")}>
        <span className={rubricLabelClass}>Sprzęt i klient</span>
        <span className={rubricLabelClass}>Zgłoszenie</span>
        <span className={rubricLabelClass}>Dostarczenie</span>
        <span />
      </div>
      <ul className="divide-y divide-[var(--sv-rule)]">
        {waitingTickets.map((t) => {
          const who = t.company || t.name || t.email;
          const day = /^\d{4}-\d{2}-\d{2}/.test(t.dateAdded) ? formatAutomatDay(t.dateAdded.slice(0, 10), todayKey) : null;
          const delivery = t.deliveryId ? DELIVERY_SHORT[t.deliveryId] : null;
          const DeliveryIcon = t.deliveryId === 2 ? IconTruck : IconPackage;
          // Wszystkie pobrane zgłoszenia są otwarte; wyróżniamy tylko nowe (jeszcze nieprzyjęte w helpdesku).
          const isNew = t.statusId === 1;
          return (
            <li key={t.id} className={cn(ROW_GRID, "grid-cols-[minmax(0,1fr)_auto] items-center py-3")}>
              <span className="min-w-0">
                <span className="block text-[0.9375rem] font-semibold leading-snug text-slate-900">{t.product || "Sprzęt bez nazwy"}</span>
                <span className="block text-[0.8125rem] leading-snug text-slate-600">{who}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 sm:hidden">
                  <span className="font-mono font-semibold">#{t.id}</span>
                  {day ? <span>{day}</span> : null}
                  {delivery ? (
                    <span className="inline-flex items-center gap-1">
                      <DeliveryIcon size={14} aria-hidden />
                      {delivery}
                    </span>
                  ) : null}
                  {isNew ? <Badge variant="info">Nowe</Badge> : null}
                </span>
              </span>
              <span className="hidden min-w-0 flex-col sm:flex">
                <span className="font-mono text-xs font-semibold text-slate-500">#{t.id}</span>
                <span className="flex items-center gap-1.5 text-[0.8125rem] text-slate-700">
                  {day ?? "—"}
                  {isNew ? <Badge variant="info">Nowe</Badge> : null}
                </span>
              </span>
              <span className="hidden items-center gap-1.5 text-[0.8125rem] text-slate-700 sm:flex">
                {delivery ? (
                  <>
                    <DeliveryIcon size={16} aria-hidden className="shrink-0 text-slate-500" />
                    {delivery}
                  </>
                ) : (
                  <span className="text-slate-500">Nie podano</span>
                )}
              </span>
              {onAccept ? (
                <Button type="button" variant="secondary" aria-label={`Przyjmij sprzęt ze zgłoszenia #${t.id}`} onClick={() => onAccept(t.id)}>
                  Przyjmij
                </Button>
              ) : (
                <span />
              )}
            </li>
          );
        })}
      </ul>
      {withOrders && onAccept ? (
        <p className="border-t border-[var(--sv-rule)] px-4 py-2.5 text-[0.8125rem] text-slate-500 sm:px-5">
          {withOrders} {polishPluralWord(withOrders, "zgłoszenie ma", "zgłoszenia mają", "zgłoszeń ma")} już przyjęty sprzęt — kolejne urządzenie {withOrders === 1 ? "z niego" : "z nich"} przyjmiesz w „Przyjmij sprzęt”.
        </p>
      ) : null}
    </section>
    </>
  );
}
