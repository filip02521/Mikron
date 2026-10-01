"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  actionCreateCustomsClearance,
  actionListSupplierRecentZd,
  type CustomsClearanceListItem,
  type CustomsSupplierOption,
  type CustomsZdOption,
} from "@/app/actions/customs-clearance";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select, fieldControlClass } from "@/components/ui/Field";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

export function CustomsClearanceListClient({
  suppliers,
  clearances,
}: {
  suppliers: CustomsSupplierOption[];
  clearances: CustomsClearanceListItem[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(clearances.length === 0);
  const [supplierId, setSupplierId] = useState("");
  const [zds, setZds] = useState<CustomsZdOption[]>([]);
  const [zdId, setZdId] = useState("");
  const [zdLoading, setZdLoading] = useState(false);
  const [zdMessage, setZdMessage] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [shipmentDescription, setShipmentDescription] = useState("");
  const [pastedLines, setPastedLines] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onSupplierChange(id: string) {
    setSupplierId(id);
    setZds([]);
    setZdId("");
    setZdMessage(null);
    if (!id) return;
    setZdLoading(true);
    const res = await actionListSupplierRecentZd(id);
    setZdLoading(false);
    if (res.ok) {
      setZds(res.zds);
      if (!res.zds.length) setZdMessage("Brak ZD tego dostawcy z ostatnich 120 dni.");
    } else {
      setZdMessage(res.error);
    }
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await actionCreateCustomsClearance({
        supplierId,
        invoiceNumber,
        invoiceDate: invoiceDate || null,
        currency,
        shipmentDescription,
        zdId: zdId ? Number(zdId) : null,
        pastedLines,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/zakupy/odprawy/${res.id}`);
    });
  }

  const canSubmit = Boolean(supplierId && invoiceNumber.trim() && (zdId || pastedLines.trim()));

  return (
    <div className="space-y-4">
      {creating ? (
        <Card>
          <CardHeader
            title="Nowa odprawa"
            description="Wybierz dostawcę i ZD z Subiekta albo wklej pozycje z faktury. Zatwierdzone wcześniej artykuły uzupełnią się same."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dostawca (import)">
              <Select value={supplierId} onChange={(e) => void onSupplierChange(e.target.value)}>
                <option value="">— wybierz —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="ZD z Subiekta"
              hint={zdLoading ? "Wczytuję ZD…" : (zdMessage ?? "Pozycje i ilości do porównania z fakturą.")}
              state={zdMessage && !zds.length ? "warning" : "default"}
            >
              <Select value={zdId} onChange={(e) => setZdId(e.target.value)} disabled={!zds.length}>
                <option value="">— bez ZD —</option>
                {zds.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.number} · {formatDate(z.date)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Numer faktury">
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="np. AI/3177/26" />
            </Field>
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <Field label="Data faktury">
                <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </Field>
              <Field label="Waluta">
                <Input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} />
              </Field>
            </div>
            <Field
              label="Przesyłka zawiera"
              hint="Do maila: „2) Przesyłka zawiera …”. Puste = jak w poprzedniej odprawie tego dostawcy."
              className="sm:col-span-2"
            >
              <Input
                value={shipmentDescription}
                onChange={(e) => setShipmentDescription(e.target.value)}
                placeholder="przyrządy używane w protetyce stomatologicznej"
              />
            </Field>
            <Field
              label="Pozycje z faktury (opcjonalnie)"
              hint="Skopiuj z Excela / PDF: kod ⇥ nazwa ⇥ ilość ⇥ cena — jedna pozycja na wiersz. Gdy puste, pozycje bierzemy z ZD."
              className="sm:col-span-2"
            >
              <textarea
                className={fieldControlClass("default", "min-h-32 font-mono text-xs")}
                value={pastedLines}
                onChange={(e) => setPastedLines(e.target.value)}
                placeholder={"DE-1196\tPlaster knife large\t10\t4,50\nDE-1698\tScalpel handle No.3\t20\t2,10"}
              />
            </Field>
          </div>
          {error ? (
            <Alert tone="error" className="mt-4">
              {error}
            </Alert>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {clearances.length ? (
              <Button variant="ghost" onClick={() => setCreating(false)} disabled={pending}>
                Anuluj
              </Button>
            ) : null}
            <Button onClick={submit} disabled={!canSubmit || pending}>
              {pending ? "Tworzę…" : "Utwórz odprawę"}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)}>Nowa odprawa</Button>
        </div>
      )}

      {clearances.length ? (
        <Card padding={false}>
          <ul className="divide-y divide-slate-100">
            {clearances.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/zakupy/odprawy/${c.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-slate-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {c.supplierName} · {c.invoiceNumber || "bez numeru"}
                    </span>
                    <span className="block text-xs text-slate-500">
                      Faktura {formatDate(c.invoiceDate)}
                      {c.zdNumber ? ` · ${c.zdNumber}` : ""} · {c.lineCount} poz.
                    </span>
                  </span>
                  {c.status === "sent" ? (
                    <Badge variant="success">Wysłane {formatDate(c.sentAt)}</Badge>
                  ) : (
                    <Badge variant="warning">W przygotowaniu</Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
