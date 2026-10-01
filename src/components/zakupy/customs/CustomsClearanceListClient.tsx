"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { actionExtractInvoiceWithAi } from "@/app/actions/customs-ai";
import {
  actionCreateCustomsClearance,
  actionUploadCustomsInvoice,
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

type AiInvoiceMeta = { total: number | null; hsCode: string | null; countryOfOrigin: string | null };

export function CustomsClearanceListClient({
  suppliers,
  clearances,
  aiEnabled,
}: {
  suppliers: CustomsSupplierOption[];
  clearances: CustomsClearanceListItem[];
  aiEnabled: boolean;
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
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [aiMeta, setAiMeta] = useState<AiInvoiceMeta | null>(null);
  const [aiReading, setAiReading] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "draft" | "sent">("");
  const [filterText, setFilterText] = useState("");
  const supplierNames = useMemo(
    () => [...new Set(clearances.map((c) => c.supplierName))].sort((a, b) => a.localeCompare(b, "pl")),
    [clearances]
  );
  const visible = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return clearances.filter(
      (c) =>
        (!filterSupplier || c.supplierName === filterSupplier) &&
        (!filterStatus || c.status === filterStatus) &&
        (!q || `${c.invoiceNumber} ${c.zdNumber ?? ""}`.toLowerCase().includes(q))
    );
  }, [clearances, filterSupplier, filterStatus, filterText]);

  async function readInvoiceWithAi(file: File) {
    setError(null);
    setAiNote(null);
    setAiReading(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await actionExtractInvoiceWithAi(fd);
    setAiReading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setInvoiceFile(file);
    const inv = res.invoice;
    if (inv.invoiceNumber) setInvoiceNumber(inv.invoiceNumber);
    if (inv.invoiceDate) setInvoiceDate(inv.invoiceDate);
    if (inv.currency) setCurrency(inv.currency);
    setPastedLines(res.pasteText);
    setAiMeta({ total: inv.total, hsCode: inv.hsCode, countryOfOrigin: inv.countryOfOrigin });
    setAiNote(
      `AI odczytało ${inv.lines.length} pozycji${inv.total != null ? `, suma ${inv.total.toLocaleString("pl-PL")} ${inv.currency ?? ""}` : ""}. Sprawdź pozycje poniżej przed utworzeniem.`
    );
  }

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
        invoiceTotal: aiMeta?.total ?? null,
        invoiceHsCode: aiMeta?.hsCode ?? null,
        countryOfOrigin: aiMeta?.countryOfOrigin ?? null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (invoiceFile) {
        const fd = new FormData();
        fd.set("file", invoiceFile);
        await actionUploadCustomsInvoice(res.id, fd);
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
            {aiEnabled ? (
              <Field
                label="Faktura PDF / skan — odczyt AI"
                hint={
                  aiReading
                    ? "AI czyta fakturę… (do 2 minut)"
                    : (aiNote ?? "Uzupełni numer, datę, walutę i pozycje. Plik trafi do odprawy.")
                }
                state={aiNote ? "success" : "default"}
                className="sm:col-span-2"
              >
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  disabled={aiReading || pending}
                  className="block w-full pt-1 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void readInvoiceWithAi(file);
                  }}
                />
              </Field>
            ) : null}
            <Field
              label="Pozycje z faktury (opcjonalnie)"
              hint="Skopiuj z Excela / PDF: kod ⇥ nazwa ⇥ ilość ⇥ cena — jedna pozycja na wiersz. Gdy puste, pozycje bierzemy z ZD."
              className="sm:col-span-2"
            >
              <textarea
                className={fieldControlClass("default", "min-h-32 sm:min-h-32 font-mono text-xs")}
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
            <Button onClick={submit} disabled={!canSubmit || pending || aiReading}>
              {pending ? "Tworzę…" : "Utwórz odprawę"}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)}>Nowa odprawa</Button>
        </div>
      )}

      {clearances.length > 3 ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <Select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} aria-label="Dostawca">
            <option value="">Wszyscy dostawcy</option>
            {supplierNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "" | "draft" | "sent")}
            aria-label="Status"
          >
            <option value="">Wszystkie statusy</option>
            <option value="draft">W przygotowaniu</option>
            <option value="sent">Wysłane</option>
          </Select>
          <Input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Szukaj: nr faktury lub ZD"
            aria-label="Szukaj"
          />
        </div>
      ) : null}

      {clearances.length ? (
        <Card padding={false}>
          {!visible.length ? (
            <p className="px-5 py-4 text-sm text-slate-500">Brak odpraw dla wybranych filtrów.</p>
          ) : null}
          <ul className="divide-y divide-slate-100">
            {visible.map((c) => (
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
