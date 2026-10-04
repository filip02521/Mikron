"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { actionUpdateCustomsShipment } from "@/app/actions/customs-clearance";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import {
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
export function CustomsShipmentCard({
  clearanceId,
  shipment,
  documentsSent,
}: {
  clearanceId: string;
  shipment: CustomsShipment;
  documentsSent: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => toDraft(shipment));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
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
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Spedytor / agencja">
          <Input value={draft.forwarder} onChange={(e) => set("forwarder", e.target.value)} placeholder="DHL, Fracht, hartrodt…" />
        </Field>
        <Field label="Nr AWB / B/L">
          <Input value={draft.transportRef} onChange={(e) => set("transportRef", e.target.value)} placeholder="784-85993040" />
        </Field>
        <Field label="ETA">
          <Input type="date" value={draft.eta ?? ""} onChange={(e) => set("eta", e.target.value)} />
        </Field>
        <Field label="Na terminalu od" hint={freeUntil ? `Bez składowego do ${freeUntil.split("-").reverse().join(".")}` : undefined}>
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
        <Field label="Należności (PLN)" hint="Cło + VAT z wyliczenia agencji">
          <Input inputMode="decimal" value={draft.dutiesAmount} onChange={(e) => set("dutiesAmount", e.target.value)} />
        </Field>
        <Field label="Opłacone">
          <Input type="date" value={draft.dutiesPaidAt ?? ""} onChange={(e) => set("dutiesPaidAt", e.target.value)} />
        </Field>
        <Field label="MRN (z ZC429)">
          <Input value={draft.mrn} onChange={(e) => set("mrn", e.target.value)} placeholder="26PL44302D00…" />
        </Field>
        <Field label="Dostarczono">
          <Input type="date" value={draft.deliveredAt ?? ""} onChange={(e) => set("deliveredAt", e.target.value)} />
        </Field>
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
