"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  actionConfirmAllCustomsLines,
  actionDescribeCnCode,
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
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Field, Input, Select, fieldControlClass } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { copyTextToClipboard } from "@/lib/ui/copy-text-to-clipboard";
import { polishPozycjeLabel, polishPluralWord } from "@/lib/email/polish-plural";

/** Biernik: „1 pozycję”, „4 pozycje”, „5 pozycji”. */
const pozycjeAcc = (n: number) => `${n} ${polishPluralWord(n, "pozycję", "pozycje", "pozycji")}`;
import { formatCnCode } from "@/lib/customs/customs-clearance";
import { CustomsShipmentCard } from "./CustomsShipmentCard";
import type { CustomsLineState } from "@/lib/customs/customs-clearance";
import {
  CUSTOMS_LINE_STATE_LABEL,
  isLineComplete,
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
const CURRENCIES = ["EUR", "USD", "GBP", "CNY", "CHF", "JPY", "PLN"] as const;

type LineFilter = "todo" | "confirmed" | "all";
type PendingConfirm = "delete" | "markSent" | "send" | "confirmAll" | null;

/** Pierwszy brakujący warunek wysyłki — wyłączony przycisk musi mówić, czego brakuje. */
function sendBlocker(input: { incomplete: number; hasInvoice: boolean; email: string }): string | null {
  if (input.incomplete > 0) return `Uzupełnij ${pozycjeAcc(input.incomplete)} (opis PL i poprawny kod CN).`;
  if (!input.hasInvoice) return "Wgraj plik faktury w sekcji Faktura.";
  if (!input.email.trim()) return "Wpisz adres agencji celnej.";
  return null;
}

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

type CnCheck = { code: string; description: string | null; siblings: string[]; year: number } | null;


/** Sprawdza wpisywany kod CN w słowniku (z opóźnieniem) — opis i ostrzeżenie dla tego, co jest w polu. */
function useCnCheck(code: string, savedCode: string, savedDescription: string | null): CnCheck {
  const digits = code.replace(/[\s.]/g, "");
  const [check, setCheck] = useState<CnCheck>(null);
  useEffect(() => {
    if (!/^\d{8}$/.test(digits) || digits === savedCode) return;
    let alive = true;
    const t = setTimeout(async () => {
      const res = await actionDescribeCnCode(digits);
      if (alive && res.ok) setCheck(res);
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [digits, savedCode]);
  if (digits === savedCode) return savedCode ? { code: savedCode, description: savedDescription, siblings: [], year: 0 } : null;
  return check?.code === digits ? check : null;
}

function CustomsLineRow({
  line,
  previous,
  documents,
  readOnly,
}: {
  line: CustomsLineView;
  previous: CustomsLineView | null;
  documents: CustomsSupplierDocumentView[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<LineDraft>(() => draftFromLine(line));
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(line.state !== "confirmed");
  const [pending, startTransition] = useTransition();
  const initial = draftFromLine(line);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const qtyMismatch = line.zdQuantity != null && line.zdQuantity !== line.quantity;
  const cnDigits = draft.cnCode.replace(/[\s.]/g, "");
  const cnCheck = useCnCheck(draft.cnCode, line.card?.cnCode ?? "", line.cnDescription);
  const cnFormatError = cnDigits && !/^\d{8}$/.test(cnDigits) ? "Kod CN to 8 cyfr (bez rozszerzenia TARIC)." : null;
  const cnMissing = cnCheck && !cnCheck.description && cnDigits !== (line.card?.cnCode ?? "");
  const cnState = cnFormatError || cnMissing || (line.cnInvalid && cnDigits === (line.card?.cnCode ?? "")) ? "warning" : "default";

  function set<K extends keyof LineDraft>(key: K, value: LineDraft[K]) {
    setError(null);
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
    setError(null);
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
        // Błąd przy wierszu, nie u góry strony — przy pozycji 300 komunikat u góry byłby niewidoczny.
        setError(res.error);
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  const positionLabel = <span className="text-xs font-semibold tabular-nums text-slate-500">{line.position}.</span>;

  // Zatwierdzona pozycja bez zmian — jedna linia; formularz po kliknięciu „Edytuj”.
  if (!expanded && !dirty && line.state === "confirmed") {
    return (
      <li className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-emerald-50/30 px-5 py-2.5">
        {positionLabel}
        <span className="min-w-0 flex-1 truncate text-sm text-slate-900" title={line.supplierName}>
          {line.card?.descriptionPl || line.supplierName}
          <span className="ml-2 text-xs text-slate-500">{line.supplierName}</span>
        </span>
        <span className="font-mono text-xs tabular-nums text-slate-600">{formatCnCode(line.card?.cnCode ?? "")}</span>
        <span className="text-xs tabular-nums text-slate-600">VAT {line.vat.rate}%</span>
        {line.cnWarning || line.descriptionWarning ? <Badge variant="warning">Do sprawdzenia</Badge> : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(true)}
          aria-label={readOnly ? `Szczegóły pozycji ${line.position}` : `Edytuj pozycję ${line.position}`}
        >
          {readOnly ? "Szczegóły" : "Edytuj"}
        </Button>
      </li>
    );
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
          {positionLabel}
          <Badge variant={STATE_BADGE[line.state]}>
            {line.state === "proposal" && line.card?.source === "ai"
              ? "Propozycja AI"
              : CUSTOMS_LINE_STATE_LABEL[line.state]}
          </Badge>
        </div>
        {line.card?.status === "confirmed" && line.card.confirmedAt ? (
          <p className="text-xs text-emerald-700">
            zatwierdzone {new Date(line.card.confirmedAt).toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" })}
          </p>
        ) : null}
        <p className="break-words text-sm leading-snug text-slate-900">{line.supplierName || "-"}</p>
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
        {line.cnWarning ? <p className="text-xs leading-snug text-amber-800">{line.cnWarning}</p> : null}
        {line.descriptionWarning ? <p className="text-xs leading-snug text-amber-800">{line.descriptionWarning}</p> : null}
      </div>

      <div className="grid min-w-0 gap-2.5 sm:grid-cols-6">
        <Field label="Opis PL" className="min-w-0 sm:col-span-4">
          <Input
            value={draft.descriptionPl}
            title={draft.descriptionPl}
            onChange={(e) => set("descriptionPl", e.target.value)}
            placeholder="np. Nożyk do wosku Lessman 17cm"
            disabled={readOnly}
          />
        </Field>
        <Field label="Materiał" className="min-w-0 sm:col-span-2">
          <Input
            value={draft.material}
            onChange={(e) => set("material", e.target.value)}
            placeholder="stal nierdzewna"
            disabled={readOnly}
          />
        </Field>
        <Field label="Kod dostawcy" className="min-w-0 sm:col-span-2">
          <Input
            value={draft.supplierArticleCode}
            // Bez kodu na fakturze kluczem jest nazwa — pełna wartość w podpowiedzi.
            title={draft.supplierArticleCode}
            onChange={(e) => set("supplierArticleCode", e.target.value)}
            disabled={readOnly}
          />
        </Field>
        <Field label="Kod CN" className="min-w-0 sm:col-span-2" state={cnState}>
          <Input
            value={draft.cnCode}
            className="font-mono tabular-nums"
            onChange={(e) => set("cnCode", e.target.value)}
            placeholder="9018 49 90"
            inputMode="numeric"
            disabled={readOnly}
          />
        </Field>
        <Field label="VAT" className="min-w-0 sm:col-span-2">
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
        {draft.vatRate === 8 ? (
          <Field
            label="Podstawa 8% (deklaracja zgodności)"
            className="min-w-0 sm:col-span-6"
            state={!draft.vatBasisDocumentId ? "warning" : "default"}
            hint={
              !draft.vatBasisDocumentId && !line.vat.warning
                ? "Bez dokumentu agencja nie przyjmie 8% - dodaj deklarację w karcie dostawcy."
                : undefined
            }
          >
            <select
              className={fieldControlClass(!draft.vatBasisDocumentId ? "warning" : "default")}
              value={draft.vatBasisDocumentId ?? ""}
              onChange={(e) => set("vatBasisDocumentId", e.target.value || null)}
              disabled={readOnly}
            >
              <option value="">- brak dokumentu -</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fileName}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <div className="space-y-0.5 sm:col-span-6">
          {cnFormatError ? <p className="text-xs text-amber-800">{cnFormatError}</p> : null}
          {cnMissing ? (
            <p className="text-xs text-amber-800">
              Kodu {formatCnCode(cnDigits)} nie ma w CN {cnCheck!.year}
              {cnCheck!.siblings.length ? ` - istniejące w tej grupie: ${cnCheck!.siblings.map(formatCnCode).join(", ")}` : ""}.
            </p>
          ) : null}
          {cnCheck?.description ? (
            <p className="line-clamp-2 text-xs leading-snug text-slate-500" title={cnCheck.description}>
              <span className="font-medium text-slate-600">CN {formatCnCode(cnCheck.code)}:</span> {cnCheck.description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-6">
          <label className="mr-auto flex min-h-9 items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="size-4"
              checked={draft.isMedicalDevice}
              onChange={(e) => set("isMedicalDevice", e.target.checked)}
              disabled={readOnly}
            />
            Wyrób medyczny
          </label>
          {line.state === "confirmed" && !dirty ? (
            <Button variant="ghost" size="sm" onClick={() => setExpanded(false)}>
              Zwiń
            </Button>
          ) : null}
          {!readOnly ? (
            <>
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
                <Button size="sm" onClick={() => save(true)} disabled={pending || Boolean(cnFormatError)}>
                  {pending ? "Zapisuję…" : "Zatwierdź"}
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="text-sm text-red-700 sm:col-span-6">
            Nie zapisano: {error}
          </p>
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
        res.imported
          ? `Wczytano opisy dla ${res.imported} pozycji jako propozycje - sprawdź i zatwierdź.`
          : "Nie wczytano nowych opisów.",
        res.skippedConfirmed ? `Już zatwierdzone wcześniej (bez zmian): ${res.skippedConfirmed}.` : "",
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
  const [confirming, setConfirming] = useState<PendingConfirm>(null);
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
  const todoCount = view.lines.length - counts.confirmed;
  // Jak w actionConfirmAllCustomsLines: karta niezatwierdzona, opis PL i istniejący kod CN.
  const completeProposals = view.lines.filter(
    (l) => l.card && l.card.status !== "confirmed" && isLineComplete(l)
  ).length;
  const [lineFilter, setLineFilter] = useState<LineFilter>(todoCount > 0 ? "todo" : "all");
  const visibleLines = useMemo(
    () =>
      view.lines
        .map((line, i) => ({ line, previous: i > 0 ? view.lines[i - 1]! : null }))
        .filter(({ line }) =>
          lineFilter === "all" ? true : lineFilter === "confirmed" ? line.state === "confirmed" : line.state !== "confirmed"
        ),
    [view.lines, lineFilter]
  );
  const blocker = sendBlocker({ incomplete: view.incompleteCount, hasInvoice: view.hasInvoiceFile, email: agencyEmail });

  function run(task: () => Promise<Notice | void>) {
    startTransition(async () => {
      const n = await task();
      setConfirming(null);
      setNotice(n ?? null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Link
            href="/zakupy/odprawy"
            className="-my-2 inline-flex min-h-10 items-center text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            ← Odprawy celne
          </Link>
          <h1 className="break-words text-2xl font-semibold tracking-tight text-slate-900">
            {view.supplierName} · {view.invoiceNumber || "bez numeru faktury"}
          </h1>
          <p className="text-sm text-slate-600">
            {polishPozycjeLabel(view.lines.length)}
            {view.zdNumber ? ` · ${view.zdNumber}` : ""} ·{" "}
            {readOnly ? (
              <Badge variant="success">Mail wysłany</Badge>
            ) : (
              <Badge variant="warning">Mail w przygotowaniu</Badge>
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
              onClick={() => setConfirming("delete")}
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
        title={`${view.supplierName} · faktura ${view.invoiceNumber || "bez numeru"}`}
      />

      <Card>
        <CardHeader title="Faktura" density="compact" />
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Numer faktury" className="min-w-0">
            <Input
              value={header.invoiceNumber}
              onChange={(e) => setHeader((h) => ({ ...h, invoiceNumber: e.target.value }))}
              disabled={readOnly}
            />
          </Field>
          <Field label="Data" className="min-w-0">
            <Input
              type="date"
              value={header.invoiceDate}
              onChange={(e) => setHeader((h) => ({ ...h, invoiceDate: e.target.value }))}
              disabled={readOnly}
            />
          </Field>
          <Field label="Waluta">
            <Select
              value={header.currency}
              onChange={(e) => setHeader((h) => ({ ...h, currency: e.target.value }))}
              disabled={readOnly}
            >
              {[...new Set([header.currency, ...CURRENCIES])].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Plik faktury" className="min-w-0">
            {view.invoiceFileName ? (
              <button
                type="button"
                title={view.invoiceFileName}
                className="block w-full max-w-full truncate pt-2 text-left text-sm font-medium text-indigo-700 hover:underline"
                onClick={async () => {
                  const res = await actionGetCustomsInvoiceUrl(view.id);
                  if (res.ok) window.open(res.url, "_blank", "noopener");
                  else setNotice({ tone: "error", text: res.error });
                }}
              >
                {view.invoiceFileName}
              </button>
            ) : (
              <span className="block pt-2 text-sm text-slate-500">brak - wgraj plik faktury</span>
            )}
          </Field>
          <Field label="Przesyłka zawiera" className="min-w-0 sm:col-span-3">
            <Input
              value={header.shipmentDescription}
              onChange={(e) => setHeader((h) => ({ ...h, shipmentDescription: e.target.value }))}
              placeholder="przyrządy używane w protetyce stomatologicznej"
              disabled={readOnly}
            />
          </Field>
          {!readOnly ? (
            <Field label={view.invoiceFileName ? "Podmień fakturę" : "Wgraj fakturę"} className="min-w-0">
              <input
                type="file"
                accept="application/pdf,image/*,.tif,.tiff"
                className="block w-full min-w-0 pt-1 text-xs text-slate-600 file:mr-2 file:min-h-9 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:text-xs file:font-medium file:text-slate-800 hover:file:bg-slate-200"
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
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-base font-semibold text-slate-900">Dokumenty dostawcy</h2>
          <p className="max-w-prose text-xs text-slate-500">
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
          <p className="max-w-prose px-5 py-4 text-sm text-slate-500">
            Brak dokumentów w karcie dostawcy - dodaj deklaracje zgodności w{" "}
            <Link href="/zakupy/dostawcy" className="font-medium text-indigo-700 hover:underline">
              kartach dostawców
            </Link>
            .
          </p>
        )}
      </Card>

      <Card padding={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-base font-semibold text-slate-900">Pozycje</h2>
          <SegmentedControl<LineFilter>
            className="mr-auto"
            density="compact"
            ariaLabel="Które pozycje pokazać"
            value={lineFilter}
            onChange={setLineFilter}
            options={[
              { value: "todo", label: `Do zrobienia (${todoCount})` },
              { value: "confirmed", label: `Zatwierdzone (${counts.confirmed})` },
              { value: "all", label: `Wszystkie (${view.lines.length})` },
            ]}
          />
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
                  if (res.remaining) parts.push(`Pozostało do zaproponowania: ${res.remaining} - uruchom ponownie.`);
                  return { tone: res.uncertain.length || res.remaining ? "warning" : "success", text: parts.join(" ") };
                })
              }
            >
              {pending ? "Pracuję…" : "Zaproponuj opisy (AI)"}
            </Button>
          ) : null}
          {!readOnly && completeProposals > 0 ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirming("confirmAll")}
            >
              Zatwierdź kompletne propozycje ({completeProposals})
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
        {visibleLines.length ? (
          <ul className="divide-y divide-slate-100">
            {visibleLines.map(({ line, previous }) => (
              <CustomsLineRow
                // Nowy klucz = świeży formularz, gdy serwer zmienił wartości (karta, propozycja AI,
                // opisy z maila, VAT z dokumentów) — inaczej pola pokazywałyby stary szkic.
                key={[line.id, line.card?.id, line.card?.status, JSON.stringify(draftFromLine(line))].join(":")}
                line={line}
                previous={previous}
                documents={view.documents}
                readOnly={readOnly}
              />
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-slate-500">
            {lineFilter === "todo"
              ? "Wszystkie pozycje zatwierdzone - mail do agencji jest kompletny."
              : "Brak pozycji w tym widoku."}
          </p>
        )}
      </Card>

      <Card>
        <CardHeader title="Mail do agencji celnej" density="compact" />
        {view.incompleteCount > 0 && !readOnly ? (
          <Alert tone="warning" className="mb-3">
            {`Bez opisu PL albo z brakującym lub nieistniejącym kodem CN: ${polishPozycjeLabel(view.incompleteCount)} - nie ma ich jeszcze w mailu.`}
          </Alert>
        ) : null}
        <textarea
          readOnly
          aria-label="Treść maila do agencji celnej (generowana z pozycji)"
          className={fieldControlClass("default", "min-h-72 sm:min-h-72 bg-slate-50 font-mono text-xs")}
          value={emailText}
        />
        <p className="mt-3 text-xs text-slate-500 [overflow-wrap:anywhere]">
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
              <label className="flex min-h-9 items-center gap-2">
                <input type="checkbox" className="size-4" checked={copyToMe} onChange={(e) => setCopyToMe(e.target.checked)} />
                Kopia do mnie
              </label>
              <label className="flex min-h-9 items-center gap-2">
                <input type="checkbox" className="size-4" checked={sendExcel} onChange={(e) => setSendExcel(e.target.checked)} />
                Dołącz Excel
              </label>
            </div>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {!readOnly && blocker ? <p className="mr-auto text-sm text-amber-800">{blocker}</p> : null}
          <Button
            variant="secondary"
            onClick={() =>
              void copyTextToClipboard(emailText).then((ok) =>
                setNotice(
                  ok
                    ? { tone: "success", text: "Skopiowano treść maila." }
                    : { tone: "error", text: "Nie udało się skopiować - zaznacz treść maila i skopiuj ręcznie (Ctrl+C)." }
                )
              )
            }
          >
            Kopiuj treść
          </Button>
          {!readOnly ? (
            <>
              <Button
                variant="ghost"
                disabled={pending || view.incompleteCount > 0}
                onClick={() => setConfirming("markSent")}
              >
                Wysłałem ręcznie
              </Button>
              <Button
                disabled={pending || Boolean(blocker)}
                onClick={() => setConfirming("send")}
              >
                {pending ? "Wysyłam…" : "Wyślij do agencji"}
              </Button>
            </>
          ) : null}
        </div>
      </Card>

      <ConfirmDialog
        open={confirming === "delete"}
        title="Usunąć odprawę?"
        message="Odprawa i jej pozycje zostaną usunięte. Zatwierdzone karty artykułów zostają i podpowiedzą się przy kolejnej fakturze."
        confirmLabel="Usuń odprawę"
        danger
        pending={pending}
        onCancel={() => setConfirming(null)}
        onConfirm={() =>
          startTransition(async () => {
            const res = await actionDeleteCustomsClearance(view.id);
            setConfirming(null);
            if (!res.ok) setNotice({ tone: "error", text: res.error });
            else router.push("/zakupy/odprawy");
          })
        }
      />
      <ConfirmDialog
        open={confirming === "confirmAll"}
        title={`Zatwierdzić ${completeProposals} ${polishPluralWord(completeProposals, "propozycję", "propozycje", "propozycji")}?`}
        message="Zatwierdzone zostaną tylko kompletne propozycje (opis PL i istniejący kod CN). Karty zapamiętają opis, kod i VAT na kolejne faktury - każdą można potem edytować."
        confirmLabel="Zatwierdź"
        pending={pending}
        onCancel={() => setConfirming(null)}
        onConfirm={() =>
          run(async () => {
            const res = await actionConfirmAllCustomsLines(view.id);
            return res.ok
              ? { tone: "success", text: `Zatwierdzono ${pozycjeAcc(res.confirmed)}.` }
              : { tone: "error", text: res.error };
          })
        }
      />
      <ConfirmDialog
        open={confirming === "markSent"}
        title="Oznaczyć jako wysłane?"
        message="Użyj, gdy mail do agencji wysłałeś ręcznie z poczty. Treść zostanie zapisana w historii, a pozycje zablokowane do edycji."
        confirmLabel="Oznacz jako wysłane"
        pending={pending}
        onCancel={() => setConfirming(null)}
        onConfirm={() =>
          run(async () => {
            const res = await actionMarkCustomsClearanceSent(view.id);
            return res.ok
              ? { tone: "success", text: "Oznaczono jako wysłane - dane zapisane w historii." }
              : { tone: "error", text: res.error };
          })
        }
      />
      <ConfirmDialog
        open={confirming === "send"}
        title="Wysłać do agencji celnej?"
        summary={agencyEmail.trim()}
        message={`Załączniki: ${[
          view.invoiceFileName ?? "faktura",
          ...view.attachments.map((a) => a.fileName),
          ...(sendExcel ? ["Excel"] : []),
        ].join(", ")}.${copyToMe ? " Kopia trafi do Ciebie." : ""}`}
        confirmLabel="Wyślij"
        pending={pending}
        onCancel={() => setConfirming(null)}
        onConfirm={() =>
          run(async () => {
            const res = await actionSendCustomsClearanceEmail(view.id, {
              to: agencyEmail,
              copyToMe,
              includeExcel: sendExcel,
            });
            return res.ok
              ? { tone: "success", text: `Wysłano do: ${res.deliveredTo.join(", ")}.` }
              : { tone: "error", text: res.error };
          })
        }
      />
    </div>
  );
}
