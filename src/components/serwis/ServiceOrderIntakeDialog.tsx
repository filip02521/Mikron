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
import { SERVICE_ORDER_TEXT_MAX } from "@/lib/orders/service-orders";
import { addDays, toDateOnly } from "@/lib/orders/service-loaners";
import { normalizePurchaseDate, warrantyMonthsFor, warrantyStatus, warrantyUntil } from "@/lib/orders/service-warranty";
import { WarrantyPill } from "@/components/serwis/service-order-view";
import { SerialHistory } from "@/components/serwis/SerialHistory";
import { fieldLabelClass } from "@/lib/ui/serwis-theme";

const labelClass = fieldLabelClass;

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
}: {
  onClose: () => void;
  onCreated: (message: string, orderId: string | undefined) => void;
  /** Zgłoszenie ma już zlecenie — otwórz jego panel zamiast zakładać drugie. */
  onOpenOrder: (orderId: string) => void;
  /** Okresy gwarancji modeli różne od domyślnego (tw_Id → miesiące). */
  warrantyMonths: ReadonlyMap<number, number>;
  /** Helpdesk mikran.pl podłączony (albo dane testowe) — pokaż pole numeru zgłoszenia. */
  helpdeskEnabled: boolean;
  /** Przyjęcie z listy zgłoszeń — formularz wypełnia się od razu z tego zgłoszenia. */
  initialHelpdeskId?: number | null;
}) {
  const formId = useId();
  const [client, setClient] = useState<PickedClient | null>(null);
  const [clientKey, setClientKey] = useState(0);
  const [phone, setPhone] = useState("");
  const [device, setDevice] = useState<PickedProduct | null>(null);
  const [deviceKey, setDeviceKey] = useState(0);
  const [helpdeskInput, setHelpdeskInput] = useState(initialHelpdeskId ? String(initialHelpdeskId) : "");
  const [draft, setDraft] = useState<HelpdeskIntakeDraft | null>(null);
  const [helpdeskError, setHelpdeskError] = useState<string | null>(null);
  const [loadingTicket, startTicket] = useTransition();
  const autoLoaded = useRef(false);
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

  const loadTicket = (raw: string | number) => {
    setHelpdeskError(null);
    startTicket(async () => {
      const res = await actionServiceHelpdeskDraft(raw);
      if (!res.ok) {
        setHelpdeskError(res.message);
        return;
      }
      const d = res.draft;
      setDraft(d);
      setHelpdeskInput(String(d.helpdeskId));
      if (d.existingOrder) return;
      // Pola z helpdesku nadpisują formularz — serwisant poprawia je przed zapisem.
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
    loadTicket(initialHelpdeskId);
    // Jedno wczytanie przy otwarciu z listy zgłoszeń; ref pilnuje podwójnego efektu w trybie Strict.
  }, [initialHelpdeskId]);  

  const purchase = normalizePurchaseDate(purchaseDate, today);
  const warranty = warrantyStatus(purchase ? warrantyUntil(purchase, warrantyMonthsFor(device?.twId ?? null, warrantyMonths)) : null, today);
  const missing = !client?.name ? "klienta" : !device?.name ? "sprzętu" : !fault.trim() ? "opisu usterki" : null;
  const linked = draft && !draft.existingOrder ? draft.helpdeskId : null;

  return (
    <ModalShell
      open
      className="touch-ui"
      onClose={onClose}
      title="Przyjmij sprzęt do serwisu"
      description="Zlecenie dostanie numer ZS. Diagnozę, części i wydanie prowadzisz potem w panelu zlecenia."
      size="md"
      bodyClassName="space-y-5 px-5 py-4 sm:px-6 sm:py-5"
      loadingMessage={pending ? "Zakładam zlecenie…" : loadingTicket ? "Pobieram zgłoszenie z helpdesku mikran.pl…" : null}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {missing ? <span className="mr-auto text-[0.8125rem] text-slate-500">Brakuje {missing}.</span> : null}
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Anuluj
          </Button>
          <Button type="submit" form={formId} disabled={pending || !!draft?.existingOrder}>
            {pending ? "Zapisuję…" : linked ? `Przyjmij ze zgłoszenia #${linked}` : "Przyjmij sprzęt"}
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
              helpdeskId: linked,
            });
            if (!res.ok) setError(res.message);
            else onCreated(res.message, res.orderId);
          });
        }}
      >
        {helpdeskEnabled ? (
          <div className="space-y-2">
            <label htmlFor={`${formId}-hd`} className={labelClass}>
              Zgłoszenie z helpdesku mikran.pl (opcjonalnie)
            </label>
            <div className="flex gap-2">
              <input
                id={`${formId}-hd`}
                value={helpdeskInput}
                inputMode="numeric"
                maxLength={12}
                placeholder="Numer zgłoszenia, np. 1234"
                onChange={(e) => setHelpdeskInput(e.target.value)}
                onKeyDown={(e) => {
                  // Enter w tym polu wczytuje zgłoszenie, nie wysyła całego formularza.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (helpdeskInput.trim()) loadTicket(helpdeskInput);
                  }
                }}
                className={`${pickerInputClass} min-w-0 flex-1 font-mono`}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={loadingTicket}
                onClick={() => (helpdeskInput.trim() ? loadTicket(helpdeskInput) : setHelpdeskError("Wpisz numer zgłoszenia."))}
              >
                {loadingTicket ? "Pobieram…" : "Wypełnij ze zgłoszenia"}
              </Button>
            </div>
            {helpdeskError ? (
              <p role="alert" className="text-[0.8125rem] text-red-700">
                {helpdeskError}
              </p>
            ) : draft?.existingOrder ? (
              <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-amber-50 px-3 py-2 text-[0.8125rem] text-amber-900">
                <span className="min-w-0 flex-1">
                  Zgłoszenie #{draft.helpdeskId} ma już zlecenie {draft.existingOrder.number}.
                </span>
                <Button type="button" size="sm" variant="secondary" onClick={() => onOpenOrder(draft.existingOrder!.id)}>
                  Otwórz {draft.existingOrder.number}
                </Button>
              </div>
            ) : draft ? (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-slate-600">
                {draft.test ? <Badge variant="warning">Dane testowe</Badge> : null}
                <span>
                  Wypełniono ze zgłoszenia #{draft.helpdeskId}.{" "}
                  {draft.clientMatch
                    ? `Klienta znaleziono w Subiekcie ${CLIENT_MATCH_LABEL[draft.clientMatch]}; niżej jego sprzęt z faktur — kliknij numer seryjny.`
                    : "Klienta nie znaleziono w Subiekcie (NIP, faktura, e-mail) — wybierz go z podpowiedzi, a pokażemy jego sprzęt z faktur."}
                  {draft.invoiceId && !draft.invoiceFound ? ` Faktury „${draft.invoiceId}” ze zgłoszenia nie ma w Subiekcie.` : ""}
                </span>
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <ClientPicker
            key={clientKey}
            value={client}
            autoFocus={!initialHelpdeskId}
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
            ticket={draft && !draft.existingOrder ? { invoice: draft.invoiceFound ?? "", product: draft.deviceName, serial: draft.serial } : null}
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
          <textarea
            id={`${formId}-fault`}
            value={fault}
            rows={3}
            maxLength={SERVICE_ORDER_TEXT_MAX.fault}
            onChange={(e) => setFault(e.target.value)}
            placeholder="Np. silnik nie rusza, iskrzy przy wyższych obrotach"
            className="w-full rounded-lg border border-slate-200 bg-card px-3 py-2 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
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

        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </form>
    </ModalShell>
  );
}
