"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { EventTimeline } from "@/components/ui/EventTimeline";
import { StatusStepper } from "@/components/ui/StatusStepper";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { cn } from "@/lib/cn";
import { SCROLL_LOCK_ALLOW_ATTR, useBodyScrollLock } from "@/lib/ui/page-scroll-lock";
import {
  actionLinkServiceOrderLoaner,
  actionMoveServiceOrder,
  actionReturnServiceOrderPart,
  actionSetServiceOrderRw,
  actionTakeServiceOrderPart,
  actionUpdateServiceOrderWorkNote,
  type ServiceOrderActionResult,
} from "@/app/actions/service-orders";
import { pickerInputClass, ProductPicker, type PickedProduct } from "@/components/serwis/SubiektPickers";
import {
  daysSince,
  formatDateOnly,
  formatDay,
  OrderStatusPill,
  orderEventMeta,
  orderEventTitle,
  orderEventTone,
  type LinkableLoaner,
  type ModelPartView,
  type OrderPartView,
} from "@/components/serwis/service-order-view";
import {
  allowedNextStatuses,
  canSetServiceOrderRw,
  flowIndex,
  isClosedServiceOrder,
  isServiceOrderLate,
  needsRw,
  primaryNextStatus,
  rwClipboardText,
  rwLines,
  SERVICE_ORDER_FLOW,
  SERVICE_ORDER_STATUS_LABEL,
  SERVICE_ORDER_TEXT_MAX,
  transitionLabel,
  type ServiceOrder,
  type ServiceOrderEvent,
  type ServiceOrderStatus,
} from "@/lib/orders/service-orders";

const STEPS = SERVICE_ORDER_FLOW.map((s) => ({ key: s, title: SERVICE_ORDER_STATUS_LABEL[s] }));

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[0.8125rem] font-semibold text-slate-600">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function ServiceOrderDrawer({
  order,
  parts,
  events,
  loaners,
  modelParts,
  today,
  onClose,
  onDone,
}: {
  order: ServiceOrder;
  parts: OrderPartView[];
  events: ServiceOrderEvent[];
  loaners: LinkableLoaner[];
  modelParts: ModelPartView[];
  today: Date;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const formId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
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
  const [rw, setRw] = useState("");
  const [copied, setCopied] = useState(false);
  const [loanerPick, setLoanerPick] = useState("");
  useBodyScrollLock(true);
  useFocusTrap(panelRef, true);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if ((e.target as HTMLElement | null)?.closest('[role="dialog"]:not([data-order-drawer])')) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [onClose, opener]);

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
  const primary = primaryNextStatus(order.status);
  const secondary = allowedNextStatuses(order.status).filter((s) => s !== primary && s !== "anulowane");
  const canCancel = allowedNextStatuses(order.status).includes("anulowane");
  const late = isServiceOrderLate(order, today);
  const lines = rwLines(parts);
  const pendingRw = needsRw(order, parts);
  const bom = order.deviceTwId ? modelParts.filter((m) => m.modelTwId === order.deviceTwId) : [];
  const partInBom = part?.twId != null && bom.some((b) => b.partTwId === part.twId);
  const linked = order.loanerUnitId ? loaners.find((l) => l.id === order.loanerUnitId) ?? null : null;
  // Najpierw egzemplarze u tego klienta (po kh_Id albo nazwie), potem pozostałe wydane.
  const linkable = [...loaners].sort((a, b) => {
    const mine = (l: LinkableLoaner) =>
      (order.clientKhId != null && l.khId === order.clientKhId) || (l.clientName ?? "").toLowerCase() === order.clientName.toLowerCase() ? 0 : 1;
    return mine(a) - mine(b) || a.code.localeCompare(b.code);
  });
  const historyItems = [...events]
    .sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id)
    .map((e) => ({ id: e.id, at: e.at, title: orderEventTitle(e), meta: orderEventMeta(e) || undefined, tone: orderEventTone(e) }));

  const move = (to: ServiceOrderStatus, note = "") => submit(() => actionMoveServiceOrder({ orderId: order.id, to, note }));

  return (
    <>
      <div className="fixed inset-0 z-[58] bg-scrim/40" onClick={onClose} aria-hidden />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-drawer-title"
        data-order-drawer
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-[34rem] flex-col border-l border-slate-200 bg-raised shadow-2xl"
        style={{ paddingTop: "env(safe-area-inset-top,0px)", paddingBottom: "env(safe-area-inset-bottom,0px)" }}
      >
        <div className="flex flex-col gap-2.5 border-b border-slate-100 px-5 pb-4 pt-5 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[0.8125rem] font-semibold text-slate-500">{order.number}</span>
            <OrderStatusPill status={order.status} />
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Zamknij"
              className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900"
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
            {` · przyjęte ${formatDay(order.createdAt)} (${daysSince(order.createdAt, today)} dni)`}
            {order.dueDate ? (
              <span className={cn(late && "font-semibold text-red-700")}>
                {` · ${late ? "termin minął" : "termin"} ${formatDateOnly(order.dueDate)}`}
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6" {...{ [SCROLL_LOCK_ALLOW_ATTR]: "" }}>
          {order.status !== "anulowane" ? (
            <StatusStepper
              compact
              label="Postęp naprawy"
              steps={STEPS}
              current={flowIndex(order.status)}
              currentTitle={order.status === "czeka_na_czesc" ? "Czeka na część" : undefined}
              currentTone={order.status === "czeka_na_czesc" ? "warn" : "brand"}
            />
          ) : null}

          {!closed ? (
            <div className="flex flex-wrap gap-2">
              {primary ? (
                <Button type="button" size="sm" disabled={pending} onClick={() => move(primary)}>
                  {transitionLabel(primary, order.status)}
                </Button>
              ) : null}
              {secondary.map((s) => (
                <Button key={s} type="button" size="sm" variant="secondary" disabled={pending} onClick={() => move(s)}>
                  {transitionLabel(s, order.status)}
                </Button>
              ))}
              {canCancel && !cancelling ? (
                <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => setCancelling(true)}>
                  Anuluj zlecenie
                </Button>
              ) : null}
            </div>
          ) : null}

          {order.status === "gotowe" && linked ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[0.8125rem] text-amber-900">
              Przy wydaniu odbierz zamiennik <b className="font-mono font-semibold">{linked.code}</b> — przyjmij zwrot na tablicy zamienników.
            </p>
          ) : null}

          {cancelling ? (
            <form
              className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4"
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
                onChange={(e) => setCancelNote(e.target.value)}
                placeholder="Powód, np. klient zrezygnował z naprawy"
                className={pickerInputClass}
              />
              {parts.length && !order.rwNumber ? (
                <p className="text-[0.8125rem] text-slate-600">Pobrane części zostaną na liście „Do RW”, dopóki ich nie oddasz albo nie wpiszesz RW.</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => setCancelling(false)} disabled={pending}>
                  Wróć
                </Button>
                <Button type="submit" size="sm" variant="danger" disabled={pending}>
                  Anuluj zlecenie
                </Button>
              </div>
            </form>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <Section title="Usterka">
            <p className="whitespace-pre-line text-sm text-slate-800">{order.fault}</p>
            {order.accessories ? <p className="text-[0.8125rem] text-slate-500">Przyjęte z: {order.accessories}</p> : null}
          </Section>

          <Section title="Opis prac">
            {closed && !order.workNote ? (
              <p className="text-[0.8125rem] text-slate-500">Bez opisu prac.</p>
            ) : closed ? (
              <p className="whitespace-pre-line text-sm text-slate-800">{order.workNote}</p>
            ) : (
            <textarea
              id={`${formId}-work`}
              aria-label="Opis prac"
              value={workNote}
              rows={3}
              maxLength={SERVICE_ORDER_TEXT_MAX.workNote}
              onChange={(e) => setWorkNote(e.target.value)}
              placeholder="Co ustaliła diagnoza, co wymieniono"
              className="w-full rounded-lg border border-slate-200 bg-card px-3 py-2 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            />
            )}
            {!closed && workNote !== order.workNote ? (
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => setWorkNote(order.workNote)} disabled={pending}>
                  Cofnij zmiany
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() => submit(() => actionUpdateServiceOrderWorkNote({ orderId: order.id, workNote }))}
                >
                  Zapisz opis
                </Button>
              </div>
            ) : null}
          </Section>

          <Section
            title={`Części do zlecenia${parts.length ? ` (${lines.length})` : ""}`}
            aside={
              !order.rwNumber && order.status !== "anulowane" && !taking ? (
                <Button type="button" size="sm" variant="secondary" onClick={() => setTaking(true)}>
                  Pobierz część
                </Button>
              ) : null
            }
          >
            {parts.length ? (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {parts.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="w-14 flex-none text-right text-sm font-semibold tabular-nums text-slate-900">{p.quantity} szt.</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-slate-900">{p.partName}</span>
                      <span className="block font-mono text-xs text-slate-500">
                        {p.partSymbol ?? "—"} · {formatDay(p.takenAt)}
                        {p.takenByName ? ` · ${p.takenByName}` : ""}
                      </span>
                    </span>
                    {!order.rwNumber ? (
                      <Button
                        type="button"
                        size="sm"
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
                className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
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
                    <span className="mb-1.5 block text-xs font-semibold text-slate-600">Z katalogu modelu</span>
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
                            "inline-flex min-h-8 max-w-full items-center rounded-2xl border px-3 py-1 text-left text-[0.8125rem] transition-colors duration-150",
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
                    <label htmlFor={`${formId}-qty`} className="mb-1.5 block text-xs font-semibold text-slate-600">
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
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
                    Zapamiętaj w katalogu modelu {order.deviceSymbol ?? order.deviceName}
                  </label>
                ) : null}
                <p className="text-[0.8125rem] text-slate-500">Pobranie zapisuje część na zleceniu. Stan w Subiekcie zejdzie po wystawieniu RW.</p>
                <div className="flex justify-end gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => setTaking(false)} disabled={pending}>
                    Anuluj
                  </Button>
                  <Button type="submit" size="sm" disabled={pending || !part?.twId || !(Number(qty) > 0)}>
                    {part?.twId ? `Pobierz ${Number(qty) || ""} szt.` : "Pobierz"}
                  </Button>
                </div>
              </form>
            ) : null}
          </Section>

          {order.rwNumber ? (
            <Section title="RW">
              <p className="text-sm text-slate-800">
                <span className="font-mono font-semibold">{order.rwNumber}</span>
                {order.rwAt ? <span className="text-slate-500"> · wpisane {formatDay(order.rwAt)}</span> : null}
              </p>
            </Section>
          ) : pendingRw ? (
            <Section title="Do RW">
              {/* W trakcie naprawy to informacja; po wydaniu/anulowaniu — zaległość do zrobienia. */}
              <div className={cn("space-y-3 rounded-xl border p-4", closed ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50")}>
                <p className={cn("text-[0.8125rem]", closed ? "text-amber-900" : "text-slate-600")}>
                  {closed
                    ? "Zlecenie zamknięte, a części nie mają RW. Wystaw w Subiekcie RW z tymi pozycjami i wpisz tu jego numer."
                    : "Po naprawie wystaw w Subiekcie RW z tymi pozycjami i wpisz tu jego numer. Do tego czasu części liczą się jako pobrane, a stan w Subiekcie ich nie widzi."}
                </p>
                <ul className="space-y-1">
                  {lines.map((l) => (
                    <li key={l.partTwId} className="flex gap-3 text-sm">
                      <span className="w-12 flex-none text-right font-semibold tabular-nums">{l.quantity}</span>
                      <span className="min-w-0 flex-1">
                        <span className="font-mono">{l.partSymbol ?? "—"}</span> <span className="text-slate-600">{l.partName}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    navigator.clipboard?.writeText(rwClipboardText(lines)).then(
                      () => setCopied(true),
                      () => setCopied(false)
                    )
                  }
                >
                  {copied ? "Skopiowano pozycje" : "Kopiuj pozycje (symbol, ilość)"}
                </Button>
                {canSetServiceOrderRw(order.status) ? (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit(() => actionSetServiceOrderRw({ orderId: order.id, rwNumber: rw }), () => setRw(""));
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`${formId}-rw`} className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Numer RW z Subiekta
                    </label>
                    <input
                      id={`${formId}-rw`}
                      value={rw}
                      maxLength={SERVICE_ORDER_TEXT_MAX.rw}
                      onChange={(e) => setRw(e.target.value)}
                      placeholder="Np. RW 15/MAG/2026"
                      className={`${pickerInputClass} font-mono`}
                    />
                  </div>
                  <Button type="submit" size="sm" disabled={pending || !rw.trim()}>
                    Zapisz RW
                  </Button>
                </form>
                ) : (
                  <p className="text-[0.8125rem] text-slate-500">Numer RW wpiszesz, gdy zlecenie będzie gotowe do wydania.</p>
                )}
              </div>
            </Section>
          ) : null}

          <Section title="Zamiennik dla klienta">
            {linked || order.loanerUnitId ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>
                  <b className="font-mono font-semibold">{linked?.code ?? "egzemplarz zwrócony"}</b>
                  {linked ? <span className="text-slate-500"> · {linked.twName}</span> : null}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="ml-auto"
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
                <label htmlFor={`${formId}-loaner`} className="block text-xs font-semibold text-slate-600">
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

          <Section title="Historia zlecenia">
            <EventTimeline label="Historia zlecenia" items={historyItems} />
          </Section>
        </div>
      </aside>
    </>
  );
}
