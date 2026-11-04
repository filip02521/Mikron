"use client";

import { useId, useState, useTransition } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { actionCreateServiceOrder } from "@/app/actions/service-orders";
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

const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600";

/** Przyjęcie sprzętu klienta: kto, co, co mu dolega. Reszta (diagnoza, części) dzieje się w panelu zlecenia. */
export function ServiceOrderIntakeDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (message: string, orderId: string | undefined) => void;
}) {
  const formId = useId();
  const [client, setClient] = useState<PickedClient | null>(null);
  const [phone, setPhone] = useState("");
  const [device, setDevice] = useState<PickedProduct | null>(null);
  const [deviceKey, setDeviceKey] = useState(0);
  const [serial, setSerial] = useState("");
  const [fault, setFault] = useState("");
  const [accessories, setAccessories] = useState("");
  const [due, setDue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const today = new Date();

  const missing = !client?.name ? "klienta" : !device?.name ? "sprzętu" : !fault.trim() ? "opisu usterki" : null;

  return (
    <ModalShell
      open
      className="touch-ui"
      onClose={onClose}
      title="Przyjmij sprzęt do serwisu"
      description="Zlecenie dostanie numer ZS. Diagnozę, części i wydanie prowadzisz potem w panelu zlecenia."
      size="md"
      bodyClassName="space-y-5 px-5 py-4 sm:px-6 sm:py-5"
      loadingMessage={pending ? "Zakładam zlecenie…" : null}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {missing ? <span className="mr-auto text-[0.8125rem] text-slate-500">Brakuje {missing}.</span> : null}
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Anuluj
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? "Zapisuję…" : "Przyjmij sprzęt"}
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
            });
            if (!res.ok) setError(res.message);
            else onCreated(res.message, res.orderId);
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <ClientPicker
            value={client}
            autoFocus
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
            selected={device?.twId ? { twId: device.twId, symbol: device.symbol, name: device.name, serial: serial.trim() } : null}
            onPick={(e) => {
              setDevice({ twId: e.twId, symbol: e.symbol, name: e.name });
              setSerial(e.serial);
              // Pole modelu czyta wartość przy montowaniu — nowy klucz pokazuje wybrany z faktury model.
              setDeviceKey((k) => k + 1);
            }}
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <ProductPicker
            key={deviceKey}
            value={device}
            onChange={setDevice}
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
