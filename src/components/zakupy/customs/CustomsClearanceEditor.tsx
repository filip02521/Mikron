"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  actionConfirmAllCustomsLines,
  actionDeleteCustomsClearance,
  actionExportCustomsExcel,
  actionGetCustomsInvoiceUrl,
  actionImportCustomsEmailDescriptions,
  actionMarkCustomsClearanceSent,
  actionSendCustomsClearanceEmail,
  actionSaveCustomsLine,
  actionSetCustomsDocumentArticles,
  actionUpdateCustomsClearanceHeader,
  actionUploadCustomsInvoice,
} from "@/app/actions/customs-clearance";
import { actionGetCustomsDocumentUrl } from "@/app/actions/supplier-customs-documents";
import {
  actionExtractDocumentArticlesWithAi,
  actionProposeCustomsLinesWithAi,
} from "@/app/actions/customs-ai";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, fieldControlClass } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { CustomsShipmentCard } from "./CustomsShipmentCard";
import type { CustomsLineState } from "@/lib/customs/customs-clearance";
import {
  CUSTOMS_LINE_STATE_LABEL,
  type CustomsClearanceView,
  type CustomsLineView,
  type CustomsSupplierDocumentView,
} from "@/lib/customs/customs-view";

const STATE_BADGE: Record<CustomsLineState, "success" | "warning" | "info" | "default"> = {
  confirmed: "success",
  confirmed_changed: "warning",
  proposal: "info",
  missing: "default",
};

const VAT_OPTIONS = [23, 8, 5, 0] as const;

type Notice = { tone: "success" | "error" | "warning"; text: string } | null;

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString("pl-PL");
}

function downloadBase64(base64: string, fileName: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

type LineDraft = {
  supplierArticleCode: string;
  descriptionPl: string;
  material: string;
  cnCode: string;
  isMedicalDevice: boolean;
  vatRate: number;
  vatBasisDocumentId: string | null;
};

function draftFromLine(line: CustomsLineView): LineDraft {
  return {
    supplierArticleCode: line.supplierArticleCode,
    descriptionPl: line.card?.descriptionPl ?? "",
    material: line.card?.material ?? "",
    cnCode: line.card?.cnCode ?? "",
    isMedicalDevice: line.vat.isMedicalDevice,
    vatRate: line.vat.rate,
    vatBasisDocumentId: line.vat.basisDocument?.id ?? null,
  };
}

function CustomsLineRow({
  line,
  previous,
  documents,
  readOnly,
  onNotice,
}: {
  line: CustomsLineView;
  previous: CustomsLineView | null;
  documents: CustomsSupplierDocumentView[];
  readOnly: boolean;
  onNotice: (n: Notice) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<LineDraft>(() => draftFromLine(line));
  const [pending, startTransition] = useTransition();
  const initial = draftFromLine(line);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const qtyMismatch = line.zdQuantity != null && line.zdQuantity !== line.quantity;

  function set<K extends keyof LineDraft>(key: K, value: LineDraft[K]) {
    setDraft((d) => {
      const next = { ...d, [key]: value };
      if (key === "vatRate") {
        next.isMedicalDevice = value === 8 ? true : d.isMedicalDevice && value !== 23;
        next.vatBasisDocumentId = value === 8 ? (d.vatBasisDocumentId ?? documents[0]?.id ?? null) : null;
      }
      return next;
    });
  }

  function copyFromPrevious() {
    if (!previous?.card) return;
    setDraft((d) => ({
      ...d,
      descriptionPl: previous.card!.descriptionPl,
      material: previous.card!.material,
      cnCode: previous.card!.cnCode ?? "",
      isMedicalDevice: previous.vat.isMedicalDevice,
      vatRate: previous.vat.rate,
      vatBasisDocumentId: previous.vat.basisDocument?.id ?? null,
    }));
  }

  function save(confirm: boolean) {
    startTransition(async () => {
      const res = await actionSaveCustomsLine({ lineId: line.id, ...draft, confirm });
      if (!res.ok) {
        onNotice({ tone: "error", text: `Poz. ${line.position}: ${res.error}` });
        return;
      }
      onNotice(null);
      router.refresh();
    });
  }

  return (
    <li
      className={cn(
        "grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]",
        line.state === "confirmed" && !dirty && "bg-emerald-50/30"
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tabular-nums text-slate-400">{line.position}.</span>
          <Badge variant={STATE_BADGE[line.state]}>
            {line.state === "proposal" && line.card?.source === "ai"
              ? "Propozycja AI"
              : CUSTOMS_LINE_STATE_LABEL[line.state]}
          </Badge>
        </div>
        {line.card?.status === "confirmed" && line.card.confirmedAt ? (
          <p className="text-[11px] text-emerald-700">
            zatwierdzone {new Date(line.card.confirmedAt).toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" })}
          </p>
        ) : null}
        <p className="text-sm leading-snug text-slate-900">{line.supplierName || "-"}</p>
        <p className="text-xs text-slate-500">
          {formatQty(line.quantity)} {line.unit}
          {line.unitPrice != null
            ? ` · ${line.unitPrice.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
            : ""}
          {qtyMismatch ? (
            <span className="ml-1 font-medium text-amber-700">· w ZD {formatQty(line.zdQuantity!)}</span>
          ) : null}
        </p>
        {line.invoiceGroup ? (
          <p className="text-xs text-slate-500" title="Opis grupy produktów z faktury (scalona komórka nad kilkoma pozycjami)">
            Grupa na fakturze: {line.invoiceGroup}
          </p>
        ) : null}
        {line.invoiceHsCode ? (
          <p className="text-xs text-slate-500" title="Kod nadawcy z faktury - tylko podpowiedź, agencji podajemy własny kod CN">
            HS na fakturze: <span className="font-mono">{line.invoiceHsCode}</span>
          </p>
        ) : null}
        {line.vat.warning ? <p className="text-xs leading-snug text-amber-800">{line.vat.warning}</p> : null}
        {line.cnDescription ? (
          <p className="text-xs leading-snug text-slate-500">
            <span className="font-medium text-slate-600">CN {line.card?.cnCode}:</span> {line.cnDescription}
          </p>
        ) : null}
        {line.cnWarning ? <p className="text-xs leading-snug text-amber-800">{line.cnWarning}</p> : null}
      </div>

      <div className="grid min-w-0 gap-2.5 sm:grid-cols-6">
        <Field label="Kod dostawcy" className="sm:col-span-1">
          <Input
            value={draft.supplierArticleCode}
            // Bez kodu na fakturze kluczem jest nazwa — pełna wartość w podpowiedzi.
            title={draft.supplierArticleCode}
            onChange={(e) => set("supplierArticleCode", e.target.value)}
            disabled={readOnly}
          />
        </Field>
        <Field label="Opis PL" className="sm:col-span-3">
          <Input
            value={draft.descriptionPl}
            onChange={(e) => set("descriptionPl", e.target.value)}
            placeholder="np. Nożyk do wosku Lessman 17cm"
            disabled={readOnly}
          />
        </Field>
        <Field label="Materiał" className="sm:col-span-2">
          <Input
            value={draft.material}
            onChange={(e) => set("material", e.target.value)}
            placeholder="stal nierdzewna"
            disabled={readOnly}
          />
        </Field>
        <Field
          label="Kod CN"
          className="sm:col-span-1"
          state={line.cnInvalid && draft.cnCode === (line.card?.cnCode ?? "") ? "warning" : "default"}
        >
          <Input
            value={draft.cnCode}
            title={line.cnDescription ?? undefined}
            onChange={(e) => set("cnCode", e.target.value)}
            placeholder="90184990"
            inputMode="numeric"
            disabled={readOnly}
          />
        </Field>
        <Field label="VAT" className="sm:col-span-1">
          <select
            className={fieldControlClass("default")}
            value={draft.vatRate}
            onChange={(e) => set("vatRate", Number(e.target.value))}
            disabled={readOnly}
          >
            {VAT_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}%
              </option>
            ))}
          </select>
        </Field>
        <Field label="Podstawa 8%" className="sm:col-span-2">
          <select
            className={fieldControlClass(draft.vatRate === 8 && !draft.vatBasisDocumentId ? "warning" : "default")}
            value={draft.vatBasisDocumentId ?? ""}
            onChange={(e) => set("vatBasisDocumentId", e.target.value || null)}
            disabled={readOnly || draft.vatRate !== 8}
          >
            <option value="">{draft.vatRate === 8 ? "- brak dokumentu -" : "nie dotyczy"}</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fileName}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-slate-700 sm:col-span-2">
          <input
            type="checkbox"
            checked={draft.isMedicalDevice}
            onChange={(e) => set("isMedicalDevice", e.target.checked)}
            disabled={readOnly}
          />
          Wyrób medyczny
        </label>
        {!readOnly ? (
          <div className="flex flex-wrap items-center justify-end gap-2 sm:col-span-6">
            {previous?.card && !draft.descriptionPl ? (
              <Button variant="ghost" size="sm" onClick={copyFromPrevious} disabled={pending}>
                Jak poz. {previous.position}
              </Button>
            ) : null}
            {dirty ? (
              <Button variant="secondary" size="sm" onClick={() => save(false)} disabled={pending}>
                Zapisz
              </Button>
            ) : null}
            {dirty || line.state !== "confirmed" ? (
              <Button size="sm" onClick={() => save(true)} disabled={pending}>
                {pending ? "Zapisuję…" : "Zatwierdź"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/** Opisy z wcześniejszego maila do agencji (wklejonego z poczty) → propozycje po numerach pozycji. */
function ImportEmailDescriptions({
  clearanceId,
  lineCount,
  onNotice,
  onClose,
}: {
  clearanceId: string;
  lineCount: number;
  onNotice: (n: Notice) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await actionImportCustomsEmailDescriptions(clearanceId, text);
      if (!res.ok) {
        onNotice({ tone: "error", text: res.error });
        return;
      }
      const parts = [
        `Wczytano opisy dla ${res.imported} pozycji jako propozycje - sprawdź i zatwierdź.`,
        res.skippedConfirmed ? `${res.skippedConfirmed} pozycji było już zatwierdzonych.` : "",
        ...res.warnings,
      ].filter(Boolean);
      onNotice({ tone: res.warnings.length ? "warning" : "success", text: parts.join(" ") });
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 border-b border-slate-100 bg-slate-50/60 px-5 py-4">
      <p className="text-sm text-slate-700">
        Wklej wcześniejszy mail do agencji z tą samą fakturą. Opisy przypiszę po numerach pozycji
        (1-{lineCount}), np. „9-10. Podkładka” albo „1-4. Prostnice … - kod CN 90184990”. „Stawka VAT 23%”
        bez numeru dotyczy wszystkich pozycji.
      </p>
      <textarea
        className={fieldControlClass("default", "min-h-48 sm:min-h-48 font-mono text-xs")}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Przesyłka zawiera:\n1-4. Prostnice do mikrosilnika - kod CN 90184990\n5. Podkładka\n6. Zacisk wiertła\n…\nStawka VAT 23%"}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
          Anuluj
        </Button>
        <Button size="sm" onClick={submit} disabled={pending || !text.trim()}>
          {pending ? "Wczytuję…" : "Wczytaj opisy"}
        </Button>
      </div>
    </div>
  );
}

function SupplierDocumentArticles({
  doc,
  clearanceId,
  aiEnabled,
  readOnly,
  onNotice,
}: {
  doc: CustomsSupplierDocumentView;
  clearanceId: string;
  aiEnabled: boolean;
  readOnly: boolean;
  onNotice: (n: Notice) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(doc.articleCodes.join("\n"));
  const [pending, startTransition] = useTransition();
  const [aiReading, setAiReading] = useState(false);
  const isSheetDoc = /\.(xlsx|csv|xls)$/i.test(doc.fileName);
  const canReadCodes = !readOnly && (isSheetDoc || aiEnabled);

  async function readWithAi() {
    setAiReading(true);
    const res = await actionExtractDocumentArticlesWithAi(doc.id);
    setAiReading(false);
    if (!res.ok) {
      onNotice({ tone: "error", text: res.error });
      return;
    }
    setText(res.text);
    setOpen(true);
    onNotice({
      tone: "warning",
      text: `Znaleziono ${res.count} kodów w ${doc.fileName}. Sprawdź listę i kliknij „Zapisz listę”.`,
    });
  }

  function save() {
    startTransition(async () => {
      const res = await actionSetCustomsDocumentArticles(doc.id, text, clearanceId);
      if (!res.ok) {
        onNotice({ tone: "error", text: res.error });
        return;
      }
      onNotice({ tone: "success", text: `${doc.fileName}: zapisano ${res.count} artykułów.` });
      setOpen(false);
      router.refresh();
    });
  }

  async function download() {
    const res = await actionGetCustomsDocumentUrl(doc.id);
    if (res.url) window.open(res.url, "_blank", "noopener");
    else onNotice({ tone: "error", text: res.error ?? "Nie udało się pobrać pliku." });
  }

  return (
    <li className="space-y-2 px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button type="button" onClick={() => void download()} className="text-sm font-medium text-indigo-700 hover:underline">
          {doc.fileName}
        </button>
        {doc.description ? <span className="text-xs text-slate-500">{doc.description}</span> : null}
        <span className="ml-auto text-xs text-slate-500">
          {doc.articleCodes.length ? `${doc.articleCodes.length} artykułów` : "brak listy artykułów"}
        </span>
        {canReadCodes ? (
          <Button variant="outline" size="sm" onClick={() => void readWithAi()} disabled={aiReading || pending}>
            {aiReading ? "Czytam…" : isSheetDoc ? "Odczytaj kody (Excel)" : "Odczytaj kody (AI)"}
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
          {open ? "Zwiń" : "Lista artykułów"}
        </Button>
      </div>
      {open ? (
        <div className="space-y-2">
          <textarea
            className={fieldControlClass("default", "min-h-40 sm:min-h-40 font-mono text-xs")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Kody artykułów z dokumentu (np. Annex A deklaracji) - jeden na wiersz:\nDE-1411\nDE-1412"}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Zapisuję…" : "Zapisz listę"}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function CustomsClearanceEditor({
  view,
  aiEnabled,
}: {
  view: CustomsClearanceView;
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const readOnly = view.status === "sent";
  const [notice, setNotice] = useState<Notice>(null);
  const [agencyEmail, setAgencyEmail] = useState(view.defaultAgencyEmail ?? "");
  const [copyToMe, setCopyToMe] = useState(true);
  const [sendExcel, setSendExcel] = useState(false);
  const [header, setHeader] = useState({
    invoiceNumber: view.invoiceNumber,
    invoiceDate: view.invoiceDate ?? "",
    currency: view.currency,
    shipmentDescription: view.shipmentDescription,
  });
  const [pending, startTransition] = useTransition();
  const [importOpen, setImportOpen] = useState(false);
  const headerDirty =
    header.invoiceNumber !== view.invoiceNumber ||
    header.invoiceDate !== (view.invoiceDate ?? "") ||
    header.currency !== view.currency ||
    header.shipmentDescription !== view.shipmentDescription;

  const counts = view.lines.reduce<Record<CustomsLineState, number>>(
    (acc, l) => ({ ...acc, [l.state]: acc[l.state] + 1 }),
    { confirmed: 0, confirmed_changed: 0, proposal: 0, missing: 0 }
  );
  const emailText = readOnly && view.sentEmailText ? view.sentEmailText : view.emailText;
  const aiProposals = view.lines.filter((l) => l.state === "proposal" && l.card?.source === "ai").length;

  function run(task: () => Promise<Notice | void>) {
    startTransition(async () => {
      const n = await task();
      setNotice(n ?? null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Link href="/zakupy/odprawy" className="text-xs font-medium text-slate-500 hover:text-slate-800">
            ← Odprawy celne
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {view.supplierName} · {view.invoiceNumber || "bez numeru faktury"}
          </h1>
          <p className="text-sm text-slate-600">
            {view.lines.length} pozycji{view.zdNumber ? ` · ${view.zdNumber}` : ""} ·{" "}
            {readOnly ? (
              <Badge variant="success">Wysłane</Badge>
            ) : (
              <Badge variant="warning">W przygotowaniu</Badge>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const res = await actionExportCustomsExcel(view.id);
                if (!res.ok) return { tone: "error", text: res.error };
                downloadBase64(res.base64, res.fileName);
              })
            }
          >
            Pobierz Excel
          </Button>
          {!readOnly ? (
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("Usunąć tę odprawę? Zatwierdzone karty artykułów zostaną.")) return;
                startTransition(async () => {
                  const res = await actionDeleteCustomsClearance(view.id);
                  if (!res.ok) setNotice({ tone: "error", text: res.error });
                  else router.push("/zakupy/odprawy");
                });
              }}
            >
              Usuń
            </Button>
          ) : null}
        </div>
      </div>

      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}

      <CustomsShipmentCard
        key={JSON.stringify(view.shipment)}
        clearanceId={view.id}
        shipment={view.shipment}
        documentsSent={readOnly}
      />

      <Card>
        <CardHeader title="Faktura" density="compact" />
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Numer faktury">
            <Input
              value={header.invoiceNumber}
              onChange={(e) => setHeader((h) => ({ ...h, invoiceNumber: e.target.value }))}
              disabled={readOnly}
            />
          </Field>
          <Field label="Data">
            <Input
              type="date"
              value={header.invoiceDate}
              onChange={(e) => setHeader((h) => ({ ...h, invoiceDate: e.target.value }))}
              disabled={readOnly}
            />
          </Field>
          <Field label="Waluta">
            <Input
              value={header.currency}
              maxLength={3}
              onChange={(e) => setHeader((h) => ({ ...h, currency: e.target.value }))}
              disabled={readOnly}
            />
          </Field>
          <Field label="Plik faktury">
            {view.invoiceFileName ? (
              <button
                type="button"
                className="block truncate pt-2 text-left text-sm font-medium text-indigo-700 hover:underline"
                onClick={async () => {
                  const res = await actionGetCustomsInvoiceUrl(view.id);
                  if (res.ok) window.open(res.url, "_blank", "noopener");
                  else setNotice({ tone: "error", text: res.error });
                }}
              >
                {view.invoiceFileName}
              </button>
            ) : (
              <span className="block pt-2 text-sm text-slate-400">brak</span>
            )}
          </Field>
          <Field label="Przesyłka zawiera" className="sm:col-span-3">
            <Input
              value={header.shipmentDescription}
              onChange={(e) => setHeader((h) => ({ ...h, shipmentDescription: e.target.value }))}
              placeholder="przyrządy używane w protetyce stomatologicznej"
              disabled={readOnly}
            />
          </Field>
          {!readOnly ? (
            <Field label={view.invoiceFileName ? "Podmień fakturę" : "Wgraj fakturę"}>
              <input
                type="file"
                accept="application/pdf,image/*,.tif,.tiff"
                className="block w-full pt-2 text-xs text-slate-600"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.set("file", file);
                  run(async () => {
                    const res = await actionUploadCustomsInvoice(view.id, fd);
                    return res.ok ? { tone: "success", text: "Faktura wgrana." } : { tone: "error", text: res.error };
                  });
                  e.target.value = "";
                }}
              />
            </Field>
          ) : null}
        </div>
        {headerDirty && !readOnly ? (
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const res = await actionUpdateCustomsClearanceHeader(view.id, {
                    ...header,
                    invoiceDate: header.invoiceDate || null,
                  });
                  return res.ok ? null : { tone: "error", text: res.error };
                })
              }
            >
              Zapisz dane faktury
            </Button>
          </div>
        ) : null}
      </Card>

      <Card padding={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3.5">
          <h2 className="mr-auto text-base font-semibold text-slate-900">Pozycje</h2>
          {(Object.keys(counts) as CustomsLineState[])
            .filter((s) => counts[s] > 0)
            .map((s) => (
              <Badge key={s} variant={STATE_BADGE[s]}>
                {CUSTOMS_LINE_STATE_LABEL[s]}: {counts[s]}
              </Badge>
            ))}
          {!readOnly && counts.confirmed < view.lines.length ? (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setImportOpen((o) => !o)}>
              Opisy z wcześniejszego maila
            </Button>
          ) : null}
          {aiEnabled && !readOnly && (counts.missing > 0 || aiProposals > 0 || view.incompleteCount > 0) ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const res = await actionProposeCustomsLinesWithAi(view.id);
                  if (!res.ok) return { tone: "error", text: res.error };
                  const parts = [`AI zaproponowało opisy dla ${res.proposed} pozycji - sprawdź i zatwierdź.`];
                  if (res.uncertain.length) parts.push(`Kod CN do sprawdzenia: ${res.uncertain.join("; ")}.`);
                  if (res.remaining) parts.push(`Zostało ${res.remaining} pozycji - uruchom ponownie.`);
                  return { tone: res.uncertain.length || res.remaining ? "warning" : "success", text: parts.join(" ") };
                })
              }
            >
              {pending ? "Pracuję…" : "Zaproponuj opisy (AI)"}
            </Button>
          ) : null}
          {!readOnly && counts.proposal > 0 ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const res = await actionConfirmAllCustomsLines(view.id);
                  return res.ok
                    ? { tone: "success", text: `Zatwierdzono ${res.confirmed} pozycji.` }
                    : { tone: "error", text: res.error };
                })
              }
            >
              Zatwierdź kompletne propozycje
            </Button>
          ) : null}
        </div>
        {importOpen && !readOnly ? (
          <ImportEmailDescriptions
            clearanceId={view.id}
            lineCount={view.lines.length}
            onNotice={setNotice}
            onClose={() => setImportOpen(false)}
          />
        ) : null}
        <ul className="divide-y divide-slate-100">
          {view.lines.map((line, i) => (
            <CustomsLineRow
              // Nowy klucz = świeży formularz, gdy serwer zmienił wartości (karta, propozycja AI,
              // opisy z maila, VAT z dokumentów) — inaczej pola pokazywałyby stary szkic.
              key={[line.id, line.card?.id, line.card?.status, JSON.stringify(draftFromLine(line))].join(":")}
              line={line}
              previous={i > 0 ? view.lines[i - 1]! : null}
              documents={view.documents}
              readOnly={readOnly}
              onNotice={setNotice}
            />
          ))}
        </ul>
      </Card>

      <Card padding={false}>
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-base font-semibold text-slate-900">Dokumenty dostawcy</h2>
          <p className="text-xs text-slate-500">
            Artykuły z listy dokumentu (np. Annex A deklaracji zgodności) dostają VAT 8% jako wyrób medyczny,
            a dokument trafia do załączników.
          </p>
        </div>
        {view.documents.length ? (
          <ul className="divide-y divide-slate-100">
            {view.documents.map((doc) => (
              <SupplierDocumentArticles
                key={doc.id}
                doc={doc}
                clearanceId={view.id}
                aiEnabled={aiEnabled}
                readOnly={readOnly}
                onNotice={setNotice}
              />
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-slate-500">
            Brak dokumentów w karcie dostawcy - dodaj deklaracje zgodności w{" "}
            <Link href="/zakupy/dostawcy" className="font-medium text-indigo-700 hover:underline">
              kartach dostawców
            </Link>
            .
          </p>
        )}
      </Card>

      <Card>
        <CardHeader title="Mail do agencji celnej" density="compact" />
        {view.incompleteCount > 0 && !readOnly ? (
          <Alert tone="warning" className="mb-3">
            {`${view.incompleteCount} pozycji bez opisu PL albo z brakującym lub nieistniejącym kodem CN - nie ma ich jeszcze w mailu.`}
          </Alert>
        ) : null}
        <textarea
          readOnly
          className={fieldControlClass("default", "min-h-72 sm:min-h-72 font-mono text-xs")}
          value={emailText}
        />
        <p className="mt-3 text-xs text-slate-500">
          Załączniki: {view.hasInvoiceFile ? (view.invoiceFileName ?? "faktura") : "brak faktury (wgraj wyżej)"}
          {view.attachments.length ? `, ${view.attachments.map((a) => a.fileName).join(", ")}` : ""}
          {sendExcel && !readOnly ? ", Excel" : ""}
        </p>
        {readOnly ? (
          <p className="mt-2 text-sm text-slate-700">
            {view.agencyEmail
              ? `Wysłano z aplikacji do: ${view.agencyEmail}`
              : "Oznaczono jako wysłane (mail wysłany poza aplikacją)."}
            {view.sentAt ? ` · ${new Date(view.sentAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}` : ""}
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <Field label="Adres agencji celnej" hint="Kilka adresów rozdziel przecinkiem. Odpowiedzi agencji trafią do Ciebie.">
              <Input
                type="text"
                inputMode="email"
                value={agencyEmail}
                onChange={(e) => setAgencyEmail(e.target.value)}
                placeholder="odprawy@agencja.pl"
              />
            </Field>
            <div className="flex flex-wrap items-center gap-3 pb-1 text-sm text-slate-700 sm:pb-7">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={copyToMe} onChange={(e) => setCopyToMe(e.target.checked)} />
                Kopia do mnie
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={sendExcel} onChange={(e) => setSendExcel(e.target.checked)} />
                Dołącz Excel
              </label>
            </div>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              void navigator.clipboard
                .writeText(emailText)
                .then(() => setNotice({ tone: "success", text: "Skopiowano treść maila." }))
            }
          >
            Kopiuj treść
          </Button>
          {!readOnly ? (
            <>
              <Button
                variant="ghost"
                disabled={pending || view.incompleteCount > 0}
                onClick={() => {
                  if (!window.confirm("Oznaczyć jako wysłane bez wysyłki z aplikacji (mail wysłany ręcznie)?")) return;
                  run(async () => {
                    const res = await actionMarkCustomsClearanceSent(view.id);
                    return res.ok
                      ? { tone: "success", text: "Oznaczono jako wysłane - dane zapisane w historii." }
                      : { tone: "error", text: res.error };
                  });
                }}
              >
                Wysłałem ręcznie
              </Button>
              <Button
                disabled={pending || view.incompleteCount > 0 || !view.hasInvoiceFile || !agencyEmail.trim()}
                onClick={() => {
                  if (!window.confirm(`Wysłać mail z załącznikami do: ${agencyEmail.trim()}?`)) return;
                  run(async () => {
                    const res = await actionSendCustomsClearanceEmail(view.id, {
                      to: agencyEmail,
                      copyToMe,
                      includeExcel: sendExcel,
                    });
                    return res.ok
                      ? { tone: "success", text: `Wysłano do: ${res.deliveredTo.join(", ")}.` }
                      : { tone: "error", text: res.error };
                  });
                }}
              >
                {pending ? "Wysyłam…" : "Wyślij do agencji"}
              </Button>
            </>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
