"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { IconChevronRight, IconCircleCheck, IconClock, IconPlus, IconPackageCheck, IconPhone, IconSearch, IconUndoLeft, IconX } from "@/components/icons/StrokeIcons";
import { EventTimeline } from "@/components/ui/EventTimeline";
import { ServiceStampStrip } from "@/components/serwis/ServiceStampStrip";
import { fieldLabelClass, fieldLabelInlineClass, rubricBoxClass, rubricHeadClass, rubricLabelClass } from "@/lib/ui/serwis-theme";
import { serviceOrderStamps } from "@/lib/orders/service-order-board";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { cn } from "@/lib/cn";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { SCROLL_LOCK_ALLOW_ATTR, useBodyScrollLock } from "@/lib/ui/page-scroll-lock";
import { sidePanelBackdropClass } from "@/lib/ui/surfaces";
import { useAnimatedClose } from "@/lib/ui/use-animated-close";
import { warrantyStatus } from "@/lib/orders/service-warranty";
import {
  actionLinkServiceOrderLoaner,
  actionMoveServiceOrder,
  actionReturnServiceOrderPart,
  actionTakeServiceOrderPart,
  actionUpdateServiceOrderWorkNote,
  type ServiceOrderActionResult,
} from "@/app/actions/service-orders";
import { pickerInputClass, ProductPicker, type PickedProduct } from "@/components/serwis/SubiektPickers";
import { ServiceOrderDocuments } from "@/components/serwis/ServiceOrderDocuments";
import { ServiceOrderWaitForm } from "@/components/serwis/ServiceOrderWaitForm";
import { ClientMessage, ServiceQuoteForm } from "@/components/serwis/ServiceQuoteForm";
import { ServiceReleaseForm } from "@/components/serwis/ServiceReleaseForm";
import { composeQuoteMessage, inboundFact, outboundFact, quoteFact } from "@/lib/orders/service-messages";
import { quoteWaitingDays } from "@/lib/orders/service-order-board";
import { ServiceOrderHelpdeskThread } from "@/components/serwis/ServiceOrderHelpdeskThread";
import { ServiceRelatedCases } from "@/components/serwis/ServiceRelatedCases";
import {
  daysSince,
  formatDateOnly,
  formatDay,
  OrderStatusPill,
  REQUEST_STATUS_LABEL,
  WarrantyPill,
  orderEventMeta,
  orderEventTitle,
  orderEventTone,
  type LinkableLoaner,
  type ModelPartView,
  type OrderPartView,
} from "@/components/serwis/service-order-view";
import {
  allowedNextStatuses,
  isBackwardTransition,
  isClosedServiceOrder,
  isServiceOrderLate,
  missingServiceOrderDocs,
  primaryNextStatus,
  formatQuoteAmount,
  rwLines,
  SERVICE_ORDER_TEXT_MAX,
  SERVICE_QUOTE_NUDGE_DAYS,
  serviceOrderPanelView,
  transitionHint,
  transitionLabel,
  waitingPartArrived,
  type ServiceOrder,
  type ServiceOrderEvent,
  type ServiceOrderStatus,
} from "@/lib/orders/service-orders";


/**
 * Serwisant pracuje na ekranie dotykowym (także laptop z ekranem dotykowym, który zgłasza mysz jako
 * główny wskaźnik) — dlatego 44 px stale, nie tylko przy `pointer: coarse` (DESIGN.md: pole dotyku min. 44 px).
 */
const touchClass = "min-h-11";


/** Ikona znaczenia ruchu: naprzód, wstrzymanie, cofnięcie — rozpoznawalne bez czytania etykiety. */
function TransitionIcon({ to, from }: { to: ServiceOrderStatus; from: ServiceOrderStatus }) {
  const Icon = isBackwardTransition(to, from)
    ? IconUndoLeft
    : to === "czeka_na_czesc"
      ? IconClock
      : to === "diagnoza"
        ? IconSearch
        : to === "gotowe"
          ? IconCircleCheck
          : to === "wydane"
            ? IconPackageCheck
            : IconChevronRight;
  return <Icon size={18} aria-hidden className="shrink-0" />;
}

/** Rubryka karty serwisowej: etykieta krojem formularza na pasku z linią, treść pod nią (DESIGN-serwis.md). */
function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className={rubricBoxClass}>
      <div className={rubricHeadClass}>
        <h3 className={rubricLabelClass}>{title}</h3>
        {aside}
      </div>
      <div className="space-y-2.5 px-3 py-3">{children}</div>
    </section>
  );
}

export function ServiceOrderDrawer({
  order,
  parts,
  events,
  loaners,
  modelParts,
  waitingPartAvailable,
  today,
  onClose,
  onDone,
  onOpenOrder,
  canOpenOrder,
}: {
  order: ServiceOrder;
  parts: OrderPartView[];
  events: ServiceOrderEvent[];
  loaners: LinkableLoaner[];
  modelParts: ModelPartView[];
  /** Ile czekającej części jest do wzięcia (Subiekt); null — nie wiadomo. */
  waitingPartAvailable: number | null;
  today: Date;
  onClose: () => void;
  onDone: (message: string) => void;
  /** Otwiera inne zlecenie (wcześniejsze tego samego egzemplarza). */
  onOpenOrder: (orderId: string) => void;
  canOpenOrder: (orderId: string) => boolean;
}) {
  const formId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  // Wjazd i wyjazd jak inne panele boczne: tylko transform, tło bez rozmycia (DESIGN.md → Elevation & Depth).
  const { panelRef, backdropRef, requestClose } = useAnimatedClose(onClose);
  // Element, który otworzył panel — zapamiętany przy montowaniu, zanim pułapka przeniesie fokus do środka.
  const [opener] = useState(() => (typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null)));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  const [workNote, setWorkNote] = useState(order.workNote);
  const [taking, setTaking] = useState(false);
  const [part, setPart] = useState<PickedProduct | null>(null);
  const [qty, setQty] = useState("1");
  const [remember, setRemember] = useState(true);
  const [waitingForm, setWaitingForm] = useState(false);
  const [quoteForm, setQuoteForm] = useState(false);
  const [releaseForm, setReleaseForm] = useState(false);
  const [loanerPick, setLoanerPick] = useState("");
  useBodyScrollLock(true);
  useFocusTrap(panelRef, true);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (e.target instanceof Element && e.target.closest('[role="dialog"]:not([data-order-drawer])')) return;
      requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [requestClose, opener]);

  const submit = (fn: () => Promise<ServiceOrderActionResult>, after?: () => void) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.message);
        return;
      }
      after?.();
      onDone(res.message);
    });
  };

  const closed = isClosedServiceOrder(order.status);
  const stamps = serviceOrderStamps(order, events);
  const primary = primaryNextStatus(order.status);
  const secondary = allowedNextStatuses(order.status).filter((s) => s !== primary && s !== "anulowane");
  const canCancel = allowedNextStatuses(order.status).includes("anulowane");
  const late = isServiceOrderLate(order, today);
  const lines = rwLines(parts);
  const bom = order.deviceTwId ? modelParts.filter((m) => m.modelTwId === order.deviceTwId) : [];
  const partInBom = part?.twId != null && bom.some((b) => b.partTwId === part.twId);
  const linked = order.loanerUnitId ? loaners.find((l) => l.id === order.loanerUnitId) ?? null : null;
  const missing = missingServiceOrderDocs(order, parts);
  const primaryHint = primary ? transitionHint(primary, { missing, loanerCode: linked?.code ?? null }) : null;
  // Widok idzie za krokiem: przy przyjęciu zamiennik, w naprawie części, przy wydaniu dokumenty i telefon.
  const view = serviceOrderPanelView(order.status);
  const partArrived = waitingPartAvailable != null && waitingPartArrived(order, new Map([[order.waitingPart?.twId ?? 0, waitingPartAvailable]]));
  // Po zamknięciu jedyna praca to brakujące dokumenty — wtedy stoją na górze, historia naprawy pod nimi.
  const docsFirst = closed && (missing.invoice || missing.rw);
  const serviceDays = daysSince(order.createdAt, closed && order.closedAt ? new Date(order.closedAt) : today);
  const serviceDaysText = `${serviceDays} ${polishPluralWord(serviceDays, "dzień", "dni", "dni")}`;
  const documents = <ServiceOrderDocuments order={order} parts={parts} pending={pending} submit={submit} />;
  // Najpierw egzemplarze u tego klienta (po kh_Id albo nazwie), potem pozostałe wydane.
  const linkable = [...loaners].sort((a, b) => {
    const mine = (l: LinkableLoaner) =>
      (order.clientKhId != null && l.khId === order.clientKhId) || (l.clientName ?? "").toLowerCase() === order.clientName.toLowerCase() ? 0 : 1;
    return mine(a) - mine(b) || a.code.localeCompare(b.code);
  });
  const historyItems = [...events]
    .sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id)
    .map((e) => ({ id: e.id, at: e.at, title: orderEventTitle(e), meta: orderEventMeta(e) || undefined, tone: orderEventTone(e) }));

  const awaitingClient = order.status === "czeka_na_akceptacje";
  const facts = [
    inboundFact(order.inbound),
    awaitingClient ? null : quoteFact(order.quote),
    closed ? outboundFact(order.outbound) : null,
  ].filter((f): f is string => f != null);
  const quoteDays = awaitingClient ? quoteWaitingDays(order.quote.sentAt, today) : null;
  const quoteMessage =
    order.quote.amount != null
      ? composeQuoteMessage({ items: [{ deviceName: order.deviceName, serialNo: order.serialNo, scope: order.quote.note }], amount: order.quote.amount })
      : null;

  const move = (to: ServiceOrderStatus, note = "") => submit(() => actionMoveServiceOrder({ orderId: order.id, to, note }));

  // Zamiennik: przy przyjęciu na górze panelu (wtedy się go wydaje), potem pod częściami.
  const loanerSection = (
    <Section title="Zamiennik dla klienta">
      {linked || order.loanerUnitId ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>
            <b className="font-mono font-semibold">{linked?.code ?? "egzemplarz zwrócony"}</b>
            {linked ? <span className="text-slate-500"> · {linked.twName}</span> : null}
          </span>
          <Button
            type="button"
            variant="secondary"
            className={cn("ml-auto", touchClass)}
            disabled={pending}
            onClick={() => submit(() => actionLinkServiceOrderLoaner({ orderId: order.id, unitId: null }))}
          >
            Odepnij
          </Button>
        </div>
      ) : closed ? (
        <p className="text-[0.8125rem] text-slate-500">Bez zamiennika.</p>
      ) : linkable.length ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (loanerPick) submit(() => actionLinkServiceOrderLoaner({ orderId: order.id, unitId: loanerPick }), () => setLoanerPick(""));
          }}
        >
          <label htmlFor={`${formId}-loaner`} className={fieldLabelInlineClass}>
            Egzemplarz wydany temu klientowi
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              id={`${formId}-loaner`}
              value={loanerPick}
              disabled={pending}
              onChange={(e) => setLoanerPick(e.target.value)}
              className={cn(pickerInputClass, "min-w-0 flex-1")}
            >
              <option value="">Wybierz egzemplarz…</option>
              {linkable.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} · {l.clientName ?? "—"}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary" disabled={pending || !loanerPick}>
              Powiąż
            </Button>
          </div>
          <p className="text-[0.8125rem] text-slate-500">
            Nie ma go na liście?{" "}
            <Link href="/serwis/zamienniki" className="font-medium text-indigo-700 underline underline-offset-2">
              Wydaj zamiennik na tablicy
            </Link>
            , a potem powiąż go tutaj.
          </p>
        </form>
      ) : (
        <p className="text-[0.8125rem] text-slate-500">
          Żaden egzemplarz nie jest wydany.{" "}
          <Link href="/serwis/zamienniki" className="font-medium text-indigo-700 underline underline-offset-2">
            Wydaj zamiennik na tablicy
          </Link>
          , a potem powiąż go tutaj.
        </p>
      )}
    </Section>
  );

  return (
    <>
      <div
        ref={(el) => {
          backdropRef.current = el;
        }}
        className={cn(sidePanelBackdropClass, "panel-slide-backdrop-enter")}
        onClick={requestClose}
        aria-hidden
      />
      <aside
        ref={(el) => {
          panelRef.current = el;
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-drawer-title"
        data-order-drawer
        className="panel-slide-enter touch-ui fixed inset-y-0 right-0 z-[60] flex w-full max-w-[34rem] flex-col border-l border-slate-200/80 bg-raised shadow-[var(--shadow-card-elevated)]"
        style={{ paddingTop: "env(safe-area-inset-top,0px)", paddingBottom: "env(safe-area-inset-bottom,0px)" }}
      >
        <div className="flex flex-col gap-2.5 border-b border-slate-100 px-5 pb-4 pt-5 sm:px-6">
          <div className="flex items-center gap-2">
            {/* Numer karty w kratce formularza, jak „Nr” na karcie serwisowej. */}
            <span className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[var(--sv-rule)] bg-card px-2.5">
              <span className={rubricLabelClass}>Nr</span>
              <span className="font-mono text-[0.8125rem] font-semibold text-slate-900">{order.number}</span>
            </span>
            {order.status === "anulowane" ? <OrderStatusPill status={order.status} /> : null}
            <button
              ref={closeRef}
              type="button"
              onClick={requestClose}
              aria-label="Zamknij"
              className="ml-auto grid h-11 w-11 place-items-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <h2 id="order-drawer-title" className="font-display text-xl font-bold leading-tight tracking-tight text-slate-900">
            {order.deviceName}
          </h2>
          <p className="text-[0.8125rem] text-slate-500">
            {order.deviceSymbol ? <span className="font-mono">{order.deviceSymbol}</span> : "Sprzęt spoza kartoteki"}
            {order.serialNo ? (
              <>
                {" · SN "}
                <span className="font-mono">{order.serialNo}</span>
              </>
            ) : null}
          </p>
          <p className="text-[0.8125rem] text-slate-600">
            <span className="font-semibold text-slate-900">{order.clientName}</span>
            {order.clientPhone ? ` · tel. ${order.clientPhone}` : ""}
            {closed && order.closedAt
              ? ` · przyjęte ${formatDay(order.createdAt)} · ${order.status === "wydane" ? "wydane" : "anulowane"} ${formatDay(order.closedAt)} · w serwisie ${serviceDaysText}`
              : ` · przyjęte ${formatDay(order.createdAt)} · w serwisie ${serviceDaysText}`}
            {order.dueDate && !closed ? (
              <span className={cn(late && "font-semibold text-red-700")}>
                {` · ${late ? "termin minął" : "termin"} ${formatDateOnly(order.dueDate)}`}
              </span>
            ) : null}
          </p>
          {/* Gwarancja liczy się na dzień przyjęcia: sprzęt przyjęty na gwarancji naprawia się na gwarancji. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <WarrantyPill status={warrantyStatus(order.warrantyUntil, new Date(order.createdAt))} />
            {order.purchaseDate ? (
              <span className="text-xs text-slate-500">
                zakup {formatDateOnly(order.purchaseDate)}
                {order.purchaseDoc ? ` · ${order.purchaseDoc}` : ""}
              </span>
            ) : null}
          </div>
          {/* Transport i wycena: każdy fakt raz — kwota czekającej wyceny stoi w rubryce nad krokami, nie tu. */}
          {facts.length ? <p className="text-[0.8125rem] text-slate-600">{facts.join(" · ")}</p> : null}
          {/* Karta serwisowa: każdy krok naprawy przybija pieczątkę z datą i tym, kto ją przybił. */}
          <ServiceStampStrip stamps={stamps} size="card" cancelled={order.status === "anulowane"} className="pt-2" />
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6" {...{ [SCROLL_LOCK_ALLOW_ATTR]: "" }}>
          {/* Powód kroku nad przyciskiem: „czeka na …” albo „część na stanie”, a pod nim co zrobić. */}
          {order.status === "czeka_na_czesc" && order.waitingPart ? (
            partArrived ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="text-sm font-semibold text-emerald-900">
                  Część na stanie: {waitingPartAvailable} szt. do wzięcia — wznów naprawę
                </div>
                <div className="text-[0.8125rem] text-emerald-800">
                  {order.waitingPart.qty} szt. {order.waitingPart.symbol ?? order.waitingPart.name}
                  {order.waitingPart.since ? ` · czekało od ${formatDay(order.waitingPart.since)}` : ""}
                </div>
              </div>
            ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="text-sm text-amber-900">
                Czeka na:{" "}
                <b className="font-semibold">
                  {order.waitingPart.qty} szt. {order.waitingPart.symbol ?? order.waitingPart.name}
                </b>
                {order.waitingPart.symbol ? <span className="text-amber-800"> · {order.waitingPart.name}</span> : null}
              </div>
              <div className="text-[0.8125rem] text-amber-800">
                {order.waitingPart.since ? `od ${formatDay(order.waitingPart.since)} · ` : ""}
                {order.waitingPart.requestStatus
                  ? `prośba do zakupów: ${REQUEST_STATUS_LABEL[order.waitingPart.requestStatus] ?? order.waitingPart.requestStatus}`
                  : "bez prośby do zakupów"}
              </div>
            </div>
            )
          ) : null}

          {awaitingClient ? (
            <Section title="Wycena dla klienta">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-display text-lg font-bold tabular-nums text-slate-900">
                  {order.quote.amount != null ? `${formatQuoteAmount(order.quote.amount)} brutto` : "bez kwoty"}
                </span>
                {order.quote.sentAt ? (
                  <span
                    className={cn(
                      "text-[0.8125rem]",
                      (quoteDays ?? 0) >= SERVICE_QUOTE_NUDGE_DAYS ? "font-semibold text-amber-800" : "text-slate-600"
                    )}
                  >
                    wysłana {formatDay(order.quote.sentAt)} · {quoteDays} {polishPluralWord(quoteDays ?? 0, "dzień", "dni", "dni")} bez odpowiedzi
                  </span>
                ) : null}
              </div>
              {order.quote.note ? <p className="whitespace-pre-line text-sm text-slate-800">{order.quote.note}</p> : null}
              <ClientMessage text={quoteMessage} label="Kopiuj wiadomość do klienta" disabledHint="Wycena bez kwoty — wróć do diagnozy i wpisz ją jeszcze raz." />
            </Section>
          ) : null}

          {!closed && (primary || secondary.length) ? (
            // Dwa poziomy do skanowania: duży krok naprzód, pod nim równe alternatywy z ikoną znaczenia.
            // Anulowanie jest osobno na dole panelu — nie stoi obok kroków naprawy.
            <div className="space-y-2">
              {primary === "wydane" && releaseForm ? (
                <ServiceReleaseForm
                  order={order}
                  parts={parts}
                  hint={primaryHint}
                  pending={pending}
                  submit={(fn) => submit(fn, () => setReleaseForm(false))}
                  onCancel={() => setReleaseForm(false)}
                />
              ) : primary ? (
                <div className="space-y-1.5">
                  <Button
                    type="button"
                    size="lg"
                    disabled={pending}
                    onClick={() => (primary === "wydane" ? setReleaseForm(true) : move(primary))}
                    className={cn("w-full", touchClass)}
                  >
                    <TransitionIcon to={primary} from={order.status} />
                    {transitionLabel(primary, order.status)}
                  </Button>
                  {primaryHint ? <p className="text-[0.8125rem] text-slate-600">{primaryHint}</p> : null}
                </div>
              ) : null}
              {secondary.length ? (
                <div className={cn("grid gap-2", secondary.length > 1 && "sm:grid-cols-2")}>
                  {secondary.map((s) => (
                    <Button
                      key={s}
                      type="button"
                      variant="secondary"
                      disabled={pending}
                      onClick={() =>
                        s === "czeka_na_czesc" ? setWaitingForm(true) : s === "czeka_na_akceptacje" ? setQuoteForm(true) : move(s)
                      }
                      className={cn("w-full", touchClass)}
                    >
                      <TransitionIcon to={s} from={order.status} />
                      {transitionLabel(s, order.status)}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}


          {waitingForm && !closed ? (
            <ServiceOrderWaitForm
              order={order}
              modelParts={modelParts}
              pending={pending}
              submit={(fn, after) =>
                submit(fn, () => {
                  setWaitingForm(false);
                  after?.();
                })
              }
              onCancel={() => setWaitingForm(false)}
            />
          ) : null}

          {quoteForm && order.status === "diagnoza" ? (
            <ServiceQuoteForm
              order={order}
              parts={parts}
              pending={pending}
              submit={(fn) => submit(fn, () => setQuoteForm(false))}
              onCancel={() => setQuoteForm(false)}
            />
          ) : null}


          {view.callClient ? (
            order.clientPhone ? (
              <a href={`tel:${order.clientPhone.replace(/[^\d+]/g, "")}`} className={buttonClass("outline", "lg", cn("w-full", touchClass))}>
                <IconPhone size={18} aria-hidden className="shrink-0" />
                Zadzwoń do klienta · {order.clientPhone}
              </a>
            ) : (
              <p className="text-[0.8125rem] text-slate-600">Brak telefonu klienta w zleceniu — numer znajdziesz w Subiekcie.</p>
            )
          ) : null}

          {view.loanerFirst ? loanerSection : null}

          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {docsFirst ? documents : null}

          <Section title="Usterka">
            <p className="whitespace-pre-line text-sm text-slate-800">{order.fault}</p>
            {order.accessories ? <p className="text-[0.8125rem] text-slate-500">Przyjęte z: {order.accessories}</p> : null}
          </Section>

          {/* Rozmowa z klientem ze zgłoszenia — bez przełączania się do helpdesku. */}
          {order.helpdeskId ? <ServiceOrderHelpdeskThread key={order.helpdeskId} helpdeskId={order.helpdeskId} /> : null}

          {/* Ten sam egzemplarz, inne naprawy klienta, inne zgłoszenia (duplikaty) — zastępuje samą historię egzemplarza. */}
          <ServiceRelatedCases order={order} canOpenOrder={canOpenOrder} onOpenOrder={onOpenOrder} />

          {view.workNoteLabel && (view.workNoteEditable || order.workNote) ? (
          <Section title={view.workNoteLabel}>
            {!view.workNoteEditable ? (
              <p className="whitespace-pre-line text-sm text-slate-800">{order.workNote}</p>
            ) : (
            <textarea
              id={`${formId}-work`}
              aria-label={view.workNoteLabel}
              value={workNote}
              rows={3}
              maxLength={SERVICE_ORDER_TEXT_MAX.workNote}
              onChange={(e) => setWorkNote(e.target.value)}
              placeholder={order.status === "diagnoza" ? "Co jest zepsute, co trzeba wymienić" : "Co zrobiono, co wymieniono"}
              className="w-full rounded-lg border border-slate-200 bg-card px-3 py-2 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            />
            )}
            {view.workNoteEditable && workNote !== order.workNote ? (
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" className={cn("w-full", touchClass)} variant="secondary" onClick={() => setWorkNote(order.workNote)} disabled={pending}>
                  Cofnij zmiany
                </Button>
                <Button
                  type="button"
                  className={cn("w-full", touchClass)}
                  disabled={pending}
                  onClick={() => submit(() => actionUpdateServiceOrderWorkNote({ orderId: order.id, workNote }))}
                >
                  Zapisz opis
                </Button>
              </div>
            ) : null}
          </Section>
          ) : null}

          {view.parts !== "hidden" ? (
          <Section
            title={`Części do zlecenia${parts.length ? ` (${lines.length})` : ""}`}
            aside={
              !order.rwNumber && view.parts === "edit" && !taking ? (
                <Button type="button" className={touchClass} variant="secondary" onClick={() => setTaking(true)}>
                  <IconPlus size={18} aria-hidden />
                  Pobierz część
                </Button>
              ) : null
            }
          >
            {parts.length ? (
              <ul className="-mx-3 divide-y divide-[var(--sv-rule)] border-y border-[var(--sv-rule)]">
                {parts.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="w-14 flex-none text-right text-sm font-semibold tabular-nums text-slate-900">{p.quantity} szt.</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-slate-900">{p.partName}</span>
                      <span className="block text-xs text-slate-500">
                        <span className="font-mono">{p.partSymbol ?? "—"}</span> · {formatDay(p.takenAt)}
                        {p.takenByName ? ` · ${p.takenByName}` : ""}
                      </span>
                    </span>
                    {!order.rwNumber ? (
                      <Button
                        type="button"
                        className={touchClass}
                        variant="secondary"
                        disabled={pending}
                        onClick={() => submit(() => actionReturnServiceOrderPart({ orderId: order.id, partId: p.id }))}
                      >
                        Oddaj
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : !taking ? (
              <p className="text-[0.8125rem] text-slate-500">Nic jeszcze nie pobrano.</p>
            ) : null}

            {taking ? (
              <form
                className="-mx-3 space-y-3 border-y border-[var(--sv-rule)] bg-[var(--sv-box)] p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!part?.twId) {
                    setError("Wybierz część z podpowiedzi Subiekta.");
                    return;
                  }
                  submit(
                    () =>
                      actionTakeServiceOrderPart({
                        orderId: order.id,
                        partTwId: part.twId!,
                        quantity: Number(qty),
                        rememberForModel: remember && !partInBom,
                      }),
                    () => {
                      setPart(null);
                      setQty("1");
                      setTaking(false);
                    }
                  );
                }}
              >
                {bom.length ? (
                  <div>
                    <span className={fieldLabelClass}>Z katalogu modelu</span>
                    <div className="flex flex-wrap gap-1.5">
                      {bom.map((b) => (
                        <button
                          key={b.partTwId}
                          type="button"
                          aria-pressed={part?.twId === b.partTwId}
                          onClick={() => {
                            setPart({ twId: b.partTwId, symbol: b.partSymbol, name: b.partName });
                            setQty(String(b.defaultQty));
                          }}
                          className={cn(
                            "inline-flex min-h-11 max-w-full items-center rounded-2xl border px-3.5 py-1.5 text-left text-sm transition-colors duration-150",
                            part?.twId === b.partTwId
                              ? "border-indigo-600 bg-indigo-50 font-semibold text-indigo-900"
                              : "border-slate-200 bg-card text-slate-700 hover:bg-slate-100"
                          )}
                        >
                          {b.partSymbol ?? b.partName}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem]">
                  <ProductPicker
                    key={part?.twId ?? "search"}
                    value={part}
                    onChange={setPart}
                    label={bom.length ? "Albo inna część z Subiekta" : "Część z Subiekta"}
                    placeholder="Symbol albo nazwa części"
                  />
                  <div>
                    <label htmlFor={`${formId}-qty`} className={fieldLabelClass}>
                      Ilość
                    </label>
                    <input
                      id={`${formId}-qty`}
                      value={qty}
                      inputMode="numeric"
                      onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
                      className={`${pickerInputClass} tabular-nums`}
                    />
                  </div>
                </div>
                {order.deviceTwId && part?.twId && !partInBom ? (
                  <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-5 w-5 accent-[var(--primary)]" />
                    Zapamiętaj w katalogu modelu {order.deviceSymbol ?? order.deviceName}
                  </label>
                ) : null}
                <p className="text-[0.8125rem] text-slate-500">Pobranie zapisuje część na zleceniu. Stan w Subiekcie zejdzie po wystawieniu RW.</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" className={cn("w-full", touchClass)} variant="secondary" onClick={() => setTaking(false)} disabled={pending}>
                    Wróć
                  </Button>
                  <Button type="submit" className={cn("w-full", touchClass)} disabled={pending || !part?.twId || !(Number(qty) > 0)}>
                    {part?.twId ? `Pobierz ${Number(qty) || ""} szt.` : "Pobierz"}
                  </Button>
                </div>
              </form>
            ) : null}
          </Section>
          ) : null}

          {view.documents && !docsFirst ? documents : null}

          {/* Zamknięte bez zamiennika: nic do zrobienia ani do pokazania. */}
          {!view.loanerFirst && !(closed && !linked && !order.loanerUnitId) ? loanerSection : null}

          <Section title="Historia zlecenia">
            <EventTimeline label="Historia zlecenia" items={historyItems} />
          </Section>

          {canCancel ? (
            // Na końcu panelu, z odstępem od kroków naprawy: anulowanie nie jest jednym z kroków.
            <div className="border-t border-slate-100 pt-5">
              {cancelling ? (
                <form
                  className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit(() => actionMoveServiceOrder({ orderId: order.id, to: "anulowane", note: cancelNote }), () => setCancelling(false));
                  }}
                >
                  <label htmlFor={`${formId}-cancel`} className="block text-sm font-semibold text-slate-900">
                    Anulowanie {order.number}
                  </label>
                  <input
                    id={`${formId}-cancel`}
                    value={cancelNote}
                    maxLength={300}
                    autoFocus
                    onChange={(e) => setCancelNote(e.target.value)}
                    placeholder="Powód, np. klient zrezygnował z naprawy"
                    className={pickerInputClass}
                  />
                  {parts.length && !order.rwNumber ? (
                    <p className="text-[0.8125rem] text-slate-600">Pobrane części zostaną na liście „Do RW”, dopóki ich nie oddasz albo nie wpiszesz RW.</p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="secondary" onClick={() => setCancelling(false)} disabled={pending} className={touchClass}>
                      Wróć
                    </Button>
                    <Button type="submit" variant="danger" disabled={pending} className={touchClass}>
                      Anuluj zlecenie
                    </Button>
                  </div>
                </form>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setCancelling(true)}
                  className={cn("w-full text-red-700 hover:text-red-800", touchClass)}
                >
                  <IconX size={18} aria-hidden />
                  Anuluj zlecenie
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
