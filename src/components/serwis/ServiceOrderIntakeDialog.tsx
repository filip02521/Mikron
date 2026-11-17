"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { actionCreateServiceOrder, actionServiceHelpdeskDraft, type HelpdeskIntakeDraft } from "@/app/actions/service-orders";
import {
  ClientPicker,
  pickerInputClass,
  ProductPicker,
  type PickedClient,
  type PickedProduct,
} from "@/components/serwis/SubiektPickers";
import { ClientEquipmentPicker } from "@/components/serwis/ClientEquipmentPicker";
import { SERVICE_INBOUND_LABEL, SERVICE_ORDER_TEXT_MAX, type ServiceInboundMethod } from "@/lib/orders/service-orders";
import type { HelpdeskTicket } from "@/lib/mikran-shop/helpdesk-parse";
import type { HelpdeskLinkedOrder } from "@/lib/data/service-orders";
import { HelpdeskTicketPicker } from "@/components/serwis/HelpdeskTicketPicker";
import { inboundFromDelivery } from "@/components/serwis/helpdesk-intake";
import { addDays, toDateOnly } from "@/lib/orders/service-loaners";
import { normalizePurchaseDate, warrantyMonthsFor, warrantyStatus, warrantyUntil } from "@/lib/orders/service-warranty";
import { WarrantyPill } from "@/components/serwis/service-order-view";
import { SerialHistory } from "@/components/serwis/SerialHistory";
import { fieldLabelClass, fieldLabelInlineClass, rubricBoxClass } from "@/lib/ui/serwis-theme";
import { IconAlertCircle, IconCircleCheck, IconMessageSquare } from "@/components/icons/StrokeIcons";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { cn } from "@/lib/cn";

const labelClass = fieldLabelClass;

/** Jedna pozycja listy „co przyszło ze zgłoszenia”: ptaszek albo uwaga z tym, co zrobić ręcznie. */
function DraftCheck({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const Icon = ok ? IconCircleCheck : IconAlertCircle;
  return (
    <li className={cn("flex items-start gap-2", ok ? "text-slate-700" : "text-amber-900")}>
      <Icon size={16} aria-hidden className={cn("mt-0.5 shrink-0", ok ? "text-emerald-700" : "text-amber-700")} />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

const CLIENT_MATCH_LABEL: Record<NonNullable<HelpdeskIntakeDraft["clientMatch"]>, string> = {
  nip: "po NIP",
  faktura: "po fakturze ze zgłoszenia",
  email: "po e-mailu",
};

/** Przyjęcie sprzętu klienta: kto, co, co mu dolega. Reszta (diagnoza, części) dzieje się w panelu zlecenia. */
export function ServiceOrderIntakeDialog({
  onClose,
  onCreated,
  onOpenOrder,
  warrantyMonths,
  helpdeskEnabled,
  initialHelpdeskId,
  tickets,
  linked,
}: {
  onClose: () => void;
  onCreated: (message: string, orderId: string | undefined) => void;
  /** Ze zgłoszenia przyjęto już sprzęt — otwórz panel tamtego zlecenia. */
  onOpenOrder: (orderId: string) => void;
  /** Okresy gwarancji modeli różne od domyślnego (tw_Id → miesiące). */
  warrantyMonths: ReadonlyMap<number, number>;
  /** Helpdesk mikran.pl podłączony (albo dane testowe) — pokaż wybór zgłoszenia. */
  helpdeskEnabled: boolean;
  /** Przyjęcie z listy zgłoszeń — formularz wypełnia się od razu z tego zgłoszenia. */
  initialHelpdeskId?: number | null;
  /** Otwarte zgłoszenia z tablicy (do wyboru bez szukania) i zlecenia już z nich przyjęte. */
  tickets: readonly HelpdeskTicket[];
  linked: Readonly<Record<number, readonly HelpdeskLinkedOrder[]>>;
}) {
  const formId = useId();
  const [client, setClient] = useState<PickedClient | null>(null);
  const [clientKey, setClientKey] = useState(0);
  const [phone, setPhone] = useState("");
  const [device, setDevice] = useState<PickedProduct | null>(null);
  const [deviceKey, setDeviceKey] = useState(0);
  const [draft, setDraft] = useState<HelpdeskIntakeDraft | null>(null);
  // Serwisant wybrał „Bez zgłoszenia” — lista zgłoszeń się zwija.
  const [noTicket, setNoTicket] = useState(false);
  const [helpdeskError, setHelpdeskError] = useState<string | null>(null);
  const [loadingTicket, startTicket] = useTransition();
  const autoLoaded = useRef(false);
  const [inbound, setInbound] = useState<ServiceInboundMethod | "">("");
  const [pickupDate, setPickupDate] = useState("");
  const [serial, setSerial] = useState("");
  const [fault, setFault] = useState("");
  const [accessories, setAccessories] = useState("");
  const [due, setDue] = useState("");
  // Zakup: z FS/PA wybranego z listy sprzętu (data + numer dokumentu) albo data wpisana przez serwisanta.
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaseDoc, setPurchaseDoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const today = new Date();

  const loadTicket = (id: number, ticket: HelpdeskTicket | null) => {
    setHelpdeskError(null);
    startTicket(async () => {
      const res = await actionServiceHelpdeskDraft(id);
      if (!res.ok) {
        setHelpdeskError(res.message);
        return;
      }
      const d = res.draft;
      setDraft(d);
      setNoTicket(false);
      // Sposób dostawy ze zgłoszenia (szkic, a gdy go nie ma — wiersz z listy); bez niego zostaje wybór serwisanta.
      setInbound(inboundFromDelivery(d.deliveryId ?? ticket?.deliveryId) ?? "");
      // Pola z helpdesku nadpisują formularz także przy kolejnym sprzęcie z tego zgłoszenia — serwisant poprawia je przed zapisem.
      setClient(d.client.name ? d.client : null);
      setClientKey((k) => k + 1);
      setPhone(d.phone || d.client.phone || "");
      setDevice(d.deviceName ? { twId: null, symbol: null, name: d.deviceName } : null);
      setDeviceKey((k) => k + 1);
      setSerial(d.serial);
      setPurchaseDate("");
      setPurchaseDoc(null);
      setFault(d.fault);
    });
  };

  useEffect(() => {
    if (!initialHelpdeskId || autoLoaded.current) return;
    autoLoaded.current = true;
    loadTicket(initialHelpdeskId, tickets.find((t) => t.id === initialHelpdeskId) ?? null);
    // Jedno wczytanie przy otwarciu z listy zgłoszeń; ref pilnuje podwójnego efektu w trybie Strict.
  }, [initialHelpdeskId, tickets]);

  const purchase = normalizePurchaseDate(purchaseDate, today);
  const warranty = warrantyStatus(purchase ? warrantyUntil(purchase, warrantyMonthsFor(device?.twId ?? null, warrantyMonths)) : null, today);
  const missing = !client?.name ? "klienta" : !device?.name ? "sprzętu" : !fault.trim() ? "opisu usterki" : null;
  const helpdeskId = draft?.helpdeskId ?? null;
  const accepted = draft?.existingOrders ?? [];

  return (
    <ModalShell
      open
      className="touch-ui"
      onClose={onClose}
      title="Przyjmij sprzęt do serwisu"
      description="Po zapisie zlecenie dostanie numer ZS i trafi na listę; dalsze kroki robisz w jego karcie."
      size="md"
      bodyClassName="space-y-5 px-5 py-4 sm:px-6 sm:py-5"
      loadingMessage={pending ? "Zakładam zlecenie…" : loadingTicket ? "Pobieram zgłoszenie z helpdesku mikran.pl…" : null}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {missing ? <span className="mr-auto text-[0.8125rem] text-slate-500">Brakuje {missing}.</span> : null}
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Anuluj
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {pending
              ? "Zapisuję…"
              : helpdeskId
                ? accepted.length
                  ? `Przyjmij kolejny sprzęt ze zgłoszenia #${helpdeskId}`
                  : `Przyjmij ze zgłoszenia #${helpdeskId}`
                : "Przyjmij sprzęt"}
          </Button>
        </div>
      }
    >
      <form
        id={formId}
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (missing) {
            setError(`Uzupełnij: ${missing}.`);
            return;
          }
          setError(null);
          start(async () => {
            const res = await actionCreateServiceOrder({
              clientKhId: client!.khId,
              clientName: client!.name,
              clientPhone: phone.trim() || client!.phone,
              deviceTwId: device!.twId,
              deviceName: device!.name,
              serialNo: serial,
              fault,
              accessories,
              dueDate: due || null,
              purchaseDate: purchaseDate || null,
              purchaseDoc,
              helpdeskId,
              inboundMethod: inbound || null,
              inboundPickupDate: inbound === "odbior_mikran" ? pickupDate || null : null,
            });
            if (!res.ok) setError(res.message);
            else onCreated(res.message, res.orderId);
          });
        }}
      >
        {helpdeskEnabled ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={fieldLabelInlineClass}>Zgłoszenie z helpdesku mikran.pl (opcjonalnie)</span>
              {!draft && !noTicket ? (
                <Button type="button" size="sm" variant="secondary" onClick={() => setNoTicket(true)}>
                  Bez zgłoszenia
                </Button>
              ) : null}
            </div>
            {draft ? (
              <div className={`${rubricBoxClass} space-y-2 px-3 py-2`}>
                {/* Co przyszło ze zgłoszenia — lista do odhaczenia zamiast akapitu; ⚠ mówi, co uzupełnić ręcznie. */}
                <ul className="space-y-1 text-[0.8125rem]">
                  <DraftCheck ok>
                    Zgłoszenie <span className="font-mono font-semibold">#{draft.helpdeskId}</span> — dane wpisane niżej
                    {draft.test ? <Badge variant="warning" className="ml-2">Dane testowe</Badge> : null}
                  </DraftCheck>
                  <DraftCheck ok={draft.serials.length > 0}>
                    {draft.serials.length === 0
                      ? "Zgłoszenie nie ma numeru seryjnego — odczytaj go z tabliczki"
                      : draft.serials.length === 1
                        ? `Numer seryjny ze zgłoszenia: ${draft.serials[0]}`
                        : `${draft.serials.length} ${polishPluralWord(draft.serials.length, "numer seryjny", "numery seryjne", "numerów seryjnych")} w zgłoszeniu — wybierz przy polu „Numer seryjny”`}
                  </DraftCheck>
                  {draft.devices && draft.devices > 1 ? (
                    <DraftCheck ok>
                      Zgłoszenie obejmuje {draft.devices} {polishPluralWord(draft.devices, "urządzenie", "urządzenia", "urządzeń")} — każde przyjmij osobno
                      {accepted.length ? ` (przyjęte: ${accepted.length})` : ""}
                    </DraftCheck>
                  ) : null}
                  <DraftCheck ok={Boolean(draft.clientMatch)}>
                    {draft.clientMatch
                      ? `Klient z Subiekta (${CLIENT_MATCH_LABEL[draft.clientMatch]}) — jego sprzęt z faktur jest niżej`
                      : "Klienta nie ma w Subiekcie — wybierz go z podpowiedzi w polu „Klient”"}
                  </DraftCheck>
                  {draft.invoiceId ? (
                    <DraftCheck ok={Boolean(draft.invoiceFound)}>
                      {draft.invoiceFound ? `Faktura ${draft.invoiceFound} — zakup potwierdzony` : `Faktury „${draft.invoiceId}” nie ma w Subiekcie — data zakupu ręcznie`}
                    </DraftCheck>
                  ) : null}
                  {!draft.invoiceId && draft.invoiceNote ? (
                    <li className="flex items-start gap-2 text-slate-700">
                      <IconMessageSquare size={16} aria-hidden className="mt-0.5 shrink-0 text-slate-500" />
                      <span className="min-w-0">
                        Klient w polu faktury: „{draft.invoiceNote}” — bez numeru, datę zakupu wpisz ręcznie
                      </span>
                    </li>
                  ) : null}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => setDraft(null)}>
                    Zmień zgłoszenie
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setDraft(null);
                      setNoTicket(true);
                    }}
                  >
                    Bez zgłoszenia
                  </Button>
                </div>
              </div>
            ) : noTicket ? (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-slate-600">
                <span>Przyjmujesz sprzęt bez zgłoszenia — wypełnij formularz niżej.</span>
                <Button type="button" size="sm" variant="secondary" onClick={() => setNoTicket(false)}>
                  Wybierz zgłoszenie
                </Button>
              </p>
            ) : (
              <HelpdeskTicketPicker inputId={`${formId}-hd`} tickets={tickets} linked={linked} autoFocus={!initialHelpdeskId} onPick={loadTicket} />
            )}
            {helpdeskError ? (
              <p role="alert" className="text-[0.8125rem] text-red-700">
                {helpdeskError}
              </p>
            ) : null}
            {accepted.length ? (
              <div role="status" className="space-y-2 rounded-lg bg-amber-50 px-3 py-2 text-[0.8125rem] text-amber-900">
                <p>
                  Z tego zgłoszenia przyjęto już:{" "}
                  {accepted.map((o) => `${o.number} (${[o.deviceName, o.serialNo ? `SN ${o.serialNo}` : null].filter(Boolean).join(", ")})`).join("; ")}.
                  {" "}Przyjmujesz kolejny sprzęt — sprawdź model i numer seryjny.
                </p>
                <div className="flex flex-wrap gap-2">
                  {accepted.map((o) => (
                    <Button key={o.id} type="button" size="sm" variant="secondary" onClick={() => onOpenOrder(o.id)}>
                      Otwórz {o.number}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <ClientPicker
            key={clientKey}
            value={client}
            autoFocus={!initialHelpdeskId && !helpdeskEnabled}
            label="Klient"
            onChange={(c) => {
              setClient(c);
              if (c?.phone && !phone) setPhone(c.phone);
            }}
          />
          <div>
            <label htmlFor={`${formId}-phone`} className={labelClass}>
              Telefon (opcjonalnie)
            </label>
            <input
              id={`${formId}-phone`}
              value={phone}
              inputMode="tel"
              maxLength={SERVICE_ORDER_TEXT_MAX.phone}
              onChange={(e) => setPhone(e.target.value)}
              className={pickerInputClass}
            />
          </div>
        </div>

        {client?.khId ? (
          <ClientEquipmentPicker
            key={client.khId}
            khId={client.khId}
            selected={device?.twId ? { twId: device.twId, serial: serial.trim() } : null}
            ticket={draft ? { invoice: draft.invoiceFound ?? "", product: draft.deviceName, serial: serial.trim() || draft.serial, serials: draft.serials } : null}
            warrantyMonths={warrantyMonths}
            onPick={(e) => {
              setDevice({ twId: e.twId, symbol: e.symbol, name: e.name });
              setSerial(e.serial);
              setPurchaseDate(e.purchaseDate ?? "");
              setPurchaseDoc(e.purchaseDate ? e.purchaseDoc : null);
              // Pole modelu czyta wartość przy montowaniu — nowy klucz pokazuje wybrany z faktury model.
              setDeviceKey((k) => k + 1);
            }}
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <ProductPicker
            key={deviceKey}
            value={device}
            onChange={(d) => {
              // Inny sprzęt niż wybrany z dokumentu — data i numer tamtego zakupu już go nie dotyczą.
              if (purchaseDoc && d?.twId !== device?.twId) {
                setPurchaseDate("");
                setPurchaseDoc(null);
              }
              setDevice(d);
            }}
            label="Sprzęt (model z Subiekta)"
            placeholder="Np. Forte 200, mikrosilnik"
            allowFreeText
            freeTextHint="Sprzęt spoza kartoteki — zapiszemy samą nazwę, bez katalogu części dla modelu."
          />
          <div>
            <label htmlFor={`${formId}-serial`} className={labelClass}>
              Numer seryjny
            </label>
            <input
              id={`${formId}-serial`}
              value={serial}
              maxLength={SERVICE_ORDER_TEXT_MAX.serial}
              onChange={(e) => setSerial(e.target.value)}
              className={`${pickerInputClass} font-mono`}
            />
          </div>
        </div>

        {/* Numery ze zgłoszenia (produkt i opis): jedno dotknięcie wpisuje numer; przyjęte już z tego zgłoszenia są oznaczone. */}
        {draft && draft.serials.length > 1 ? (
          <div className="space-y-1.5">
            <span className={fieldLabelInlineClass}>Numery seryjne ze zgłoszenia</span>
            <div role="group" aria-label="Numery seryjne ze zgłoszenia" className="flex flex-wrap gap-1.5">
              {draft.serials.map((sn) => {
                const key = sn.replace(/\s+/g, "").toUpperCase();
                const taken = accepted.find((o) => (o.serialNo ?? "").replace(/\s+/g, "").toUpperCase() === key);
                const active = serial.replace(/\s+/g, "").toUpperCase() === key;
                return (
                  <button
                    key={sn}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSerial(sn)}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[0.8125rem] transition-colors duration-150",
                      active ? "border-indigo-600 bg-indigo-50 font-semibold text-indigo-900" : "border-slate-200 bg-card text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    {sn}
                    {taken ? <span className="font-sans text-xs font-normal text-slate-500">· przyjęty {taken.number}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <SerialHistory serial={serial} />

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <div className="flex min-w-0 flex-col justify-end gap-1">
            <span className={labelClass}>Gwarancja</span>
            <div className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1">
              {purchase ? (
                <WarrantyPill status={warranty} />
              ) : (
                <span className="text-[0.8125rem] text-slate-600">
                  {purchaseDate ? "Data zakupu nie może być z przyszłości." : "Wpisz datę zakupu albo wybierz sprzęt z faktury."}
                </span>
              )}
              {purchase && purchaseDoc ? <span className="text-xs text-slate-500">z {purchaseDoc}</span> : null}
            </div>
          </div>
          <div>
            <label htmlFor={`${formId}-purchase`} className={labelClass}>
              Data zakupu
            </label>
            <input
              id={`${formId}-purchase`}
              type="date"
              value={purchaseDate}
              max={toDateOnly(today)}
              min="2000-01-01"
              onChange={(e) => {
                setPurchaseDate(e.target.value);
                // Ręcznie zmieniona data nie pochodzi już z dokumentu.
                setPurchaseDoc(null);
              }}
              className={pickerInputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor={`${formId}-fault`} className={labelClass}>
            Usterka — co zgłasza klient
          </label>
          {draft?.faultFrom === "serwis" && fault ? (
            <p className="mb-1.5 text-xs text-slate-500">Z wiadomości serwisu w zgłoszeniu (klient nic nie napisał) — zostaw sam opis usterki.</p>
          ) : null}
          <textarea
            id={`${formId}-fault`}
            value={fault}
            // Rośnie z tekstem (opisy ze zgłoszeń mają do ~10 wierszy), dalej przewija się.
            rows={Math.min(10, Math.max(4, fault.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 60)), 0)))}
            maxLength={SERVICE_ORDER_TEXT_MAX.fault}
            onChange={(e) => setFault(e.target.value)}
            placeholder="Np. silnik nie rusza, iskrzy przy wyższych obrotach"
            className="w-full rounded-lg border border-slate-200 bg-card px-3 py-2 text-base leading-relaxed text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-[0.9375rem]"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <div>
            <label htmlFor={`${formId}-acc`} className={labelClass}>
              Przyjęte akcesoria (opcjonalnie)
            </label>
            <input
              id={`${formId}-acc`}
              value={accessories}
              maxLength={SERVICE_ORDER_TEXT_MAX.accessories}
              onChange={(e) => setAccessories(e.target.value)}
              placeholder="Np. zasilacz, pedał, bez kabla"
              className={pickerInputClass}
            />
          </div>
          <div>
            <label htmlFor={`${formId}-due`} className={labelClass}>
              Termin dla klienta (opcjonalnie)
            </label>
            <input
              id={`${formId}-due`}
              type="date"
              value={due}
              min={toDateOnly(today)}
              max={toDateOnly(addDays(today, 365))}
              onChange={(e) => setDue(e.target.value)}
              className={pickerInputClass}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <div>
            <label htmlFor={`${formId}-inbound`} className={labelClass}>
              Jak sprzęt przyszedł (opcjonalnie)
            </label>
            <select
              id={`${formId}-inbound`}
              value={inbound}
              onChange={(e) => setInbound(e.target.value as ServiceInboundMethod | "")}
              className={pickerInputClass}
            >
              <option value="">Nie wiadomo</option>
              {(Object.keys(SERVICE_INBOUND_LABEL) as ServiceInboundMethod[]).map((m) => (
                <option key={m} value={m}>
                  {SERVICE_INBOUND_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
          {inbound === "odbior_mikran" ? (
            <div>
              <label htmlFor={`${formId}-pickup`} className={labelClass}>
                Odbiór kurierem — dzień
              </label>
              <input
                id={`${formId}-pickup`}
                type="date"
                value={pickupDate}
                min="2000-01-01"
                max={toDateOnly(addDays(today, 60))}
                onChange={(e) => setPickupDate(e.target.value)}
                className={pickerInputClass}
              />
            </div>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </form>
    </ModalShell>
  );
}
