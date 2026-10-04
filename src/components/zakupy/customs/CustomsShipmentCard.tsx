"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { actionUpdateCustomsShipment } from "@/app/actions/customs-clearance";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, fieldControlClass } from "@/components/ui/Field";
import { copyTextToClipboard } from "@/lib/ui/copy-text-to-clipboard";
import { cn } from "@/lib/cn";
import {
  EMPTY_SHIPMENT,
  SHIPMENT_STAGE_LABEL,
  lastFreeStorageDay,
  shipmentAlerts,
  shipmentStage,
  todayInWarsaw,
  type CustomsShipment,
  type ShipmentAlert,
  type ShipmentStage,
} from "@/lib/customs/customs-shipment";

export const STAGE_BADGE: Record<ShipmentStage, "default" | "success" | "warning" | "info" | "danger"> = {
  none: "default",
  in_transit: "info",
  at_terminal: "warning",
  duties_due: "danger",
  cleared: "success",
  delivered: "success",
};

export const ALERT_BADGE: Record<ShipmentAlert["tone"], "danger" | "warning" | "info"> = {
  danger: "danger",
  warning: "warning",
  info: "info",
};

type Draft = Omit<CustomsShipment, "freeStorageDays" | "dutiesAmount"> & { freeStorageDays: string; dutiesAmount: string };

function toDraft(s: CustomsShipment): Draft {
  return {
    ...s,
    freeStorageDays: String(s.freeStorageDays),
    dutiesAmount: s.dutiesAmount == null ? "" : String(s.dutiesAmount).replace(".", ","),
  };
}

function fromDraft(d: Draft): CustomsShipment {
  const duties = d.dutiesAmount.replace(/\s/g, "").replace(",", ".");
  return {
    ...d,
    eta: d.eta || null,
    arrivedAt: d.arrivedAt || null,
    dutiesPaidAt: d.dutiesPaidAt || null,
    deliveredAt: d.deliveredAt || null,
    freeStorageDays: Number(d.freeStorageDays || 0),
    dutiesAmount: duties ? Number(duties) : null,
  };
}

/** Przesyłka przy odprawie: etap, terminy składowania i należności — edytowalna także po wysłaniu maila. */
function dutiesNoteForPayment(s: CustomsShipment, title: string): string {
  const amount = s.dutiesAmount!.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return [
    `Należności celne do zapłaty: ${amount} zł`,
    title,
    s.forwarder ? `Agencja / spedytor: ${s.forwarder}` : "",
    s.transportRef ? `Przesyłka (AWB / B/L): ${s.transportRef}` : "",
    "Po zapłacie prześlij proszę potwierdzenie przelewu do agencji - od tego zależy zwolnienie towaru.",
  ]
    .filter(Boolean)
    .join("\n");
}

function Group({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <fieldset className={cn("min-w-0 space-y-3 rounded-lg border border-slate-100 p-3", className)}>
      <legend className="px-1 text-xs font-semibold text-slate-600">{title}</legend>
      {children}
    </fieldset>
  );
}

export function CustomsShipmentCard({
  clearanceId,
  shipment,
  documentsSent,
  title,
}: {
  clearanceId: string;
  shipment: CustomsShipment;
  documentsSent: boolean;
  /** „Dostawca · faktura” — do notatki dla osoby płacącej należności. */
  title: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => toDraft(shipment));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Po zapisie karta montuje się od nowa — otwarta, gdy cokolwiek odbiega od pustej przesyłki.
  const [open, setOpen] = useState(JSON.stringify(shipment) !== JSON.stringify(EMPTY_SHIPMENT));
  const [copied, setCopied] = useState<boolean | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(shipment));
  const current = fromDraft(draft);
  const stage = shipmentStage(current);
  const alerts = shipmentAlerts(current, documentsSent, todayInWarsaw());
  const freeUntil = lastFreeStorageDay(current);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  function save() {
    startTransition(async () => {
      const res = await actionUpdateCustomsShipment(clearanceId, fromDraft(draft));
      setError(res.ok ? null : res.error);
      if (res.ok) router.refresh();
    });
  }

  if (!open) {
    return (
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-slate-900">Przesyłka</h2>
          <p className="mr-auto text-sm text-slate-500">
            Gdy towar wyjedzie, wpisz spedytora, AWB i ETA - przypomnę o składowaniu i należnościach.
          </p>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Dodaj dane przesyłki
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Przesyłka"
        density="compact"
        action={<Badge variant={STAGE_BADGE[stage]}>{SHIPMENT_STAGE_LABEL[stage]}</Badge>}
      />
      {alerts.length ? (
        <ul className="mb-3 flex flex-wrap gap-2">
          {alerts.map((a) => (
            <li key={a.text}>
              <Badge variant={ALERT_BADGE[a.tone]}>{a.text}</Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Group title="Transport">
          <Field label="Spedytor / agencja">
            <Input value={draft.forwarder} onChange={(e) => set("forwarder", e.target.value)} placeholder="DHL, Fracht, hartrodt…" />
          </Field>
          <Field label="Nr AWB / B/L">
            <Input
              value={draft.transportRef}
              className="font-mono"
              onChange={(e) => set("transportRef", e.target.value)}
              placeholder="784-85993040"
            />
          </Field>
          <Field label="ETA">
            <Input type="date" value={draft.eta ?? ""} onChange={(e) => set("eta", e.target.value)} />
          </Field>
        </Group>
        <Group title="Terminal">
          <Field
            label="Na terminalu od"
            hint={
              !freeUntil
                ? "Dzień przyjęcia u agencji"
                : current.freeStorageDays === 0
                  ? "Składowe od dnia przybycia"
                  : `Bez składowego do ${freeUntil.split("-").reverse().join(".")}`
            }
          >
            <Input type="date" value={draft.arrivedAt ?? ""} onChange={(e) => set("arrivedAt", e.target.value)} />
          </Field>
          <Field label="Dni bez składowego" hint="Z dniem przybycia (DHL: 3)">
            <Input
              type="number"
              min={0}
              max={60}
              value={draft.freeStorageDays}
              onChange={(e) => set("freeStorageDays", e.target.value)}
            />
          </Field>
        </Group>
        <Group title="Należności i zakończenie" className="md:col-span-2 xl:col-span-1">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <Field label="Należności (PLN)" hint="Cło + VAT z wyliczenia agencji">
              <Input
                inputMode="decimal"
                className="tabular-nums"
                value={draft.dutiesAmount}
                onChange={(e) => set("dutiesAmount", e.target.value)}
              />
            </Field>
            <Field label="Opłacone">
              <Input type="date" value={draft.dutiesPaidAt ?? ""} onChange={(e) => set("dutiesPaidAt", e.target.value)} />
            </Field>
          </div>
          <Field label="MRN (z ZC429)">
            <Input value={draft.mrn} className="font-mono" onChange={(e) => set("mrn", e.target.value)} placeholder="26PL44302D00…" />
          </Field>
          <Field label="Dostarczono">
            <Input type="date" value={draft.deliveredAt ?? ""} onChange={(e) => set("deliveredAt", e.target.value)} />
          </Field>
          {current.dutiesAmount != null && current.dutiesAmount > 0 && !current.dutiesPaidAt && !dirty ? (
            <div className="space-y-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void copyTextToClipboard(dutiesNoteForPayment(current, title)).then(setCopied)}
              >
                {copied ? "Skopiowano - wklej Darii" : "Kopiuj dla Darii"}
              </Button>
              {copied === false ? (
                <>
                  <p className="text-xs text-amber-800">Przeglądarka zablokowała schowek - zaznacz tekst poniżej i skopiuj (Ctrl+C).</p>
                  <textarea
                    readOnly
                    aria-label="Notatka o należnościach dla Darii"
                    className={fieldControlClass("default", "min-h-28 bg-slate-50 text-xs")}
                    value={dutiesNoteForPayment(current, title)}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </>
              ) : null}
            </div>
          ) : null}
        </Group>
      </div>
      {error ? (
        <Alert tone="error" className="mt-3">
          {error}
        </Alert>
      ) : null}
      {dirty ? (
        <div className="mt-3 flex justify-end">
          <Button size="sm" disabled={pending} onClick={save}>
            {pending ? "Zapisuję…" : "Zapisz przesyłkę"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
