"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { SupplierContactActions } from "@/components/procurement/SupplierContactActions";
import { ZdAutomatStageBar, zdAutomatStageText } from "@/components/summary/DailyZdAutomatOrders";
import { DailyZdProposalNotice } from "@/components/summary/DailyZdProposals";
import { SupplierQuickActionsMenu } from "@/components/procurement/SupplierQuickActionsMenu";
import { checkboxBrandClass } from "@/lib/ui/ontime-theme";
import { formatUrgentVacationHint } from "@/lib/orders/procurement-daily-ui";
import type { SupplierSummaryMeta } from "@/lib/orders/summary-workspace";
import { stockSignalHasWork } from "@/lib/stock-watch/signal";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { dailyPanelSectionHref } from "@/lib/orders/daily-panel-section-anchors";
import { useScheduleSupplierActions } from "@/components/summary/ScheduleSupplierActionBar";
import { ShiftMenu } from "@/components/summary/ShiftMenu";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import type { useZdAutomatOrderSheet } from "@/components/summary/useZdAutomatOrderSheet";
import { buildZdEstimateLaunchHref } from "@/lib/orders/zd-estimate-supplier-scope";
import { DAILY_PANEL_MARK_ORDERED_LABEL, DAILY_PANEL_MARK_ORDERED_PENDING } from "@/lib/orders/daily-panel-mark-ordered-copy";
import {
  IconAlertCircle,
  IconCalendar,
  IconChevronRight,
  IconInbox,
  IconSettings,
  IconSun,
} from "@/components/icons/StrokeIcons";
import { formatPln, formatRunOutDate } from "@/components/stock-watch/stock-watch-format";
import {
  SupplierStockSignal,
  brakiSupplierHref,
  daysFromToday,
  formatDaysAhead,
  stockSignalComputedDay,
  stockSignalUrgentLabel,
} from "@/components/summary/SupplierStockSignal";
import { cn } from "@/lib/cn";
import { locationLabel, vacationNoteLabel } from "@/lib/display-labels";
import { polishPluralWord } from "@/lib/email/polish-plural";
import {
  DAILY_SUPPLIER_SOURCE_LABEL,
  type DailySupplierRow as DailySupplierRowData,
  type DailySupplierSource,
} from "@/lib/orders/daily-supplier-rows";
import { panelTypography } from "@/lib/ui/ontime-theme";

const SOURCE_ICON: Record<DailySupplierSource, typeof IconCalendar> = {
  automat: IconSettings,
  harmonogram: IconCalendar,
  "poza-planem": IconAlertCircle,
  "na-zadanie": IconInbox,
};

type StatusTone = "neutral" | "danger" | "success" | "warning";

const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  neutral: "text-slate-700",
  danger: "text-red-700",
  success: "text-emerald-800",
  warning: "text-amber-900",
};

const runsOut = (n: number) =>
  `${n} ${polishPluralWord(n, "towar", "towary", "towarów")} się ${polishPluralWord(n, "skończy", "skończą", "skończy")}`;

/** Jeden stan wiersza: najwyżej trzy słowa z liczbą (reszta w rozwinięciu). */
export function dailySupplierStatus(row: DailySupplierRowData): { text: string; tone: StatusTone } {
  if (row.group === "done") return { text: row.automatOrder ? "Wysłane" : "ZD z dziś", tone: "success" };
  if (row.group === "send") {
    const stage = row.automatOrder?.stage;
    if (stage === "send") return { text: "ZD gotowe", tone: "success" };
    if (stage === "unconfirmed") return { text: "Subiekt nie potwierdził", tone: "warning" };
    const p = row.automatOrder?.proposal ?? row.pendingProposal;
    return { text: p ? `${p.lineCount} poz. · ${formatPln(p.valueNet)}` : "Zamówienie gotowe", tone: "neutral" };
  }
  if (row.group === "shift") return { text: "Stan wystarcza", tone: "success" };
  if (row.zdToday && row.action?.kind === "ordered") return { text: "ZD z dziś", tone: "success" };
  const s = row.signal;
  if (row.group === "early" && row.offPlanCount > 0) return { text: runsOut(row.offPlanCount), tone: "danger" };
  if (s && s.criticalCount > 0) return { text: `${stockSignalUrgentLabel(s.criticalCount)} · ${s.lineCount} poz.`, tone: "danger" };
  if (s && s.lineCount > 0) return { text: `${s.lineCount} poz. · ${formatPln(s.orderValue)}`, tone: "neutral" };
  const before = s?.beforeDeliveryCount || row.offPlanCount;
  if (before > 0) return { text: runsOut(before), tone: "danger" };
  if (row.group === "order" && row.requestCount + row.stockOutCount > 0) return { text: "Prośby czekają", tone: "neutral" };
  if (!s) return { text: "Brak analizy", tone: "neutral" };
  return row.signalStale ? { text: `analiza z ${stockSignalComputedDay(s) ?? "-"}`, tone: "warning" } : { text: "Stan wystarcza", tone: "success" };
}

/** „Zamówione” w wierszu: przy pilnych pozycjach Do ZD najpierw potwierdzenie (wiersz trzyma okno). */
type ConfirmOrdered = (markOrdered: () => void) => void;

export type DailySupplierAutomatControls = Pick<ReturnType<typeof useZdAutomatOrderSheet>, "start" | "startProposal" | "loadingId" | "error">;

const actionButtonClass = "min-h-11 font-semibold sm:min-h-8";

/** Jedna szybka akcja wiersza — wynika z grupy (model), nie z miejsca na ekranie. */
function RowAction({
  row,
  run,
  pending,
  automat,
  confirmOrdered,
}: {
  row: DailySupplierRowData;
  run: DailyPanelRunFn;
  pending: boolean;
  automat: DailySupplierAutomatControls;
  confirmOrdered: ConfirmOrdered;
}) {
  const { markOrdered, shiftHandlers } = useScheduleSupplierActions(row.supplierId, row.supplierName, run);
  const action = row.action;
  if (!action) return null;
  switch (action.kind) {
    case "automat": {
      const proposalId = row.automatOrder?.proposal.id ?? row.pendingProposal?.id ?? null;
      const busy = proposalId != null && automat.loadingId === proposalId;
      return (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={actionButtonClass}
          disabled={busy}
          onClick={() => {
            if (row.automatOrder) void automat.start(row.automatOrder);
            else if (row.pendingProposal) automat.startProposal(row.pendingProposal);
          }}
        >
          {busy ? "Wczytuję…" : action.label}
        </Button>
      );
    }
    case "prepareZd":
      return (
        <Link
          href={buildZdEstimateLaunchHref(row.supplierId, action.horizon ? { leadTimeHorizon: true } : undefined)}
          className={buttonClass("outline", "sm", actionButtonClass)}
          title={action.horizon ? "Kreator ZD z ilościami do kolejnej dostawy" : undefined}
        >
          Przygotuj ZD
        </Link>
      );
    case "braki":
      return (
        <Link href={brakiSupplierHref(row.supplierId)} className={buttonClass("outline", "sm", actionButtonClass)}>
          Pokaż w Braki
        </Link>
      );
    case "shift":
      return <ShiftMenu disabled={pending} className="[&>button]:max-sm:min-h-11" {...shiftHandlers} />;
    case "ordered":
      return (
        <Button type="button" variant="outline" size="sm" className={actionButtonClass} disabled={pending} onClick={() => confirmOrdered(markOrdered)}>
          {pending ? DAILY_PANEL_MARK_ORDERED_PENDING : DAILY_PANEL_MARK_ORDERED_LABEL}
        </Button>
      );
  }
}

/** Szczegóły pod wierszem: to, czego nie trzeba widzieć przy skanowaniu listy, i rzadsze akcje. */
function RowDetails({
  id,
  row,
  meta,
  todayKey,
  expiresKey,
  run,
  pending,
  onOpenSupplier,
  onVacation,
  onEdit,
  confirmOrdered,
}: {
  id: string;
  row: DailySupplierRowData;
  meta: SupplierSummaryMeta | undefined;
  todayKey: string;
  expiresKey: string | null;
  run: DailyPanelRunFn;
  pending: boolean;
  onOpenSupplier: (id: string) => void;
  onVacation: (id: string) => void;
  onEdit: (id: string) => void;
  confirmOrdered: ConfirmOrdered;
}) {
  const { markOrdered, shiftHandlers } = useScheduleSupplierActions(row.supplierId, row.supplierName, run);
  const stage = row.automatOrder ? zdAutomatStageText(row.automatOrder, todayKey, expiresKey) : null;
  const planDays = row.offPlanNextOrderDate ? daysFromToday(row.offPlanNextOrderDate, todayKey) : null;
  const vacationHint = row.schedule ? formatUrgentVacationHint(row.schedule) : null;
  return (
    <div id={id} className="zd-automat-detail-enter space-y-2 col-span-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600 sm:col-span-3">
      {row.sources.length > 1 ? <p>Źródła: {row.sources.map((s) => DAILY_SUPPLIER_SOURCE_LABEL[s]).join(", ")}</p> : null}
      {row.automatOrder && stage ? (
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <ZdAutomatStageBar stage={row.automatOrder.stage} />
          <p className={stage.tone === "warning" ? "text-amber-800" : stage.tone === "success" ? "text-emerald-800" : undefined}>
            {stage.text}
          </p>
        </div>
      ) : null}
      {row.pendingProposal && row.group === "send" ? <DailyZdProposalNotice proposal={row.pendingProposal} hideReview /> : null}
      {row.signal && stockSignalHasWork(row.signal) ? (
        <SupplierStockSignal supplierId={row.supplierId} hidePrepare={row.group === "send" || row.action?.kind === "prepareZd"} />
      ) : null}
      {row.offPlanCount > 0 ? (
        <p className="tabular-nums">
          {row.offPlanNextOrderDate
            ? `Plan ${formatRunOutDate(row.offPlanNextOrderDate)}${planDays != null ? ` · ${formatDaysAhead(planDays)}` : ""} - `
            : ""}
          zapas nie wystarczy do planowego zamówienia ({row.offPlanCount}{" "}
          {polishPluralWord(row.offPlanCount, "towar", "towary", "towarów")}).
        </p>
      ) : null}
      {vacationHint ? <p className="text-amber-900">{vacationHint}</p> : null}
      {meta ? (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span>{locationLabel(meta.location)}</span>
          <span aria-hidden className="text-slate-400">
            ·
          </span>
          <SupplierContactActions notes={meta.notes} mails={meta.mails} extraInfo={meta.extra_info} display="rowMeta" />
        </p>
      ) : null}
      {row.schedule ? (
        // Drugorzędne akcje terminu — bez pełnego Petrolu: główną akcją wiersza jest przycisk po prawej.
        <div role="group" aria-label={`Akcje harmonogramu - ${row.supplierName}`} className="flex flex-wrap items-center gap-1.5">
          {row.action?.kind === "ordered" ? null : (
            <Button type="button" variant="secondary" size="sm" className="max-sm:min-h-11" disabled={pending} onClick={() => confirmOrdered(markOrdered)}>
              {DAILY_PANEL_MARK_ORDERED_LABEL}
            </Button>
          )}
          {row.action?.kind === "shift" ? null : <ShiftMenu disabled={pending} {...shiftHandlers} />}
          <SupplierQuickActionsMenu
            includeOrderActions={false}
            supplierId={row.supplierId}
            supplierName={row.supplierName}
            location={row.schedule.location}
            pending={pending}
            run={run}
            runScope={row.supplierId}
            onOpenDetails={() => onOpenSupplier(row.supplierId)}
            onVacation={() => onVacation(row.supplierId)}
            onEdit={() => onEdit(row.supplierId)}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Wiersz dostawcy na liście „Dostawcy na dziś”: nazwa, źródło, termin i jeden stan. */
export function DailySupplierRow({
  row,
  canOpen,
  onOpenSupplier,
  run,
  pending,
  automat,
  meta,
  todayKey,
  expiresKey = null,
  onVacation,
  onEdit,
  checked,
  onToggle,
  reserveCheckbox = false,
}: {
  row: DailySupplierRowData;
  /** Dostawca ma kartę (`supplierMeta`) — inaczej nazwa jest tekstem. */
  canOpen: boolean;
  onOpenSupplier: (id: string) => void;
  run: DailyPanelRunFn;
  /** Akcja tego dostawcy jest w toku (zakres = id dostawcy). */
  pending: boolean;
  automat: DailySupplierAutomatControls;
  meta?: SupplierSummaryMeta;
  todayKey: string;
  /** Dzień, w którym czekające zamówienie automatu wygasa. */
  expiresKey?: string | null;
  onVacation: (id: string) => void;
  onEdit: (id: string) => void;
  /** Zbiorcze „Zamówione” — tylko wiersze z terminem harmonogramu mają pole wyboru. */
  checked?: boolean;
  onToggle?: () => void;
  /** Lista ma pola wyboru: wiersz bez pola zostawia na nie miejsce, żeby nazwy stały równo. */
  reserveCheckbox?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // „Zamówione” bez ZD przy pilnych brakach to częsty błąd — pytamy, zanim termin zniknie z listy.
  const [orderedToConfirm, setOrderedToConfirm] = useState<(() => void) | null>(null);
  const urgentCount = row.signal?.criticalCount ?? 0;
  const confirmOrdered: ConfirmOrdered = (markOrdered) => {
    // ZD z dziś już jest — pytanie „czy ZD przygotowane” byłoby szumem.
    if (urgentCount > 0 && !row.zdToday) setOrderedToConfirm(() => markOrdered);
    else markOrdered();
  };
  const detailsId = useId();
  const status = dailySupplierStatus(row);
  const proposalId = row.automatOrder?.proposal.id ?? row.pendingProposal?.id ?? null;
  const loadError = proposalId != null && automat.error?.id === proposalId ? automat.error.message : null;
  const source = row.sources[0];
  const SourceIcon = source ? SOURCE_ICON[source] : null;
  const staleNote =
    row.signal && row.signalStale && !status.text.startsWith("analiza z")
      ? `analiza z ${stockSignalComputedDay(row.signal) ?? "-"}`
      : null;

  return (
    <li
      className={cn(
        // Telefon: nazwa na całą szerokość, pod nią stan i akcja w jednej linii (wiersz o ~1/3 niższy niż ze stosem).
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto_9.5rem] sm:px-4 lg:px-5",
        pending && "opacity-60"
      )}
      aria-busy={pending}
    >
      <div className="col-span-2 flex min-w-0 items-start gap-1.5 sm:col-span-1">
        {row.schedule && onToggle ? (
          <input
            type="checkbox"
            className={cn("mt-1.5 h-5 w-5 shrink-0 sm:mt-1 sm:h-4 sm:w-4", checkboxBrandClass)}
            checked={!!checked}
            disabled={pending}
            onChange={onToggle}
            aria-label={`Zaznacz ${row.supplierName}`}
          />
        ) : reserveCheckbox ? (
          <span aria-hidden className="h-5 w-5 shrink-0 sm:h-4 sm:w-4" />
        ) : null}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={`${open ? "Zwiń" : "Rozwiń"} szczegóły: ${row.supplierName}`}
          className="-ml-1 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:size-7"
          onClick={() => setOpen((v) => !v)}
        >
          <IconChevronRight size={16} aria-hidden className={cn("transition-transform duration-200 motion-reduce:transition-none", open && "rotate-90")} />
        </button>
        <div className="min-w-0 flex-1">
          {canOpen ? (
            <button
              type="button"
              className={cn(
                panelTypography.rowTitle,
                // Cicha kreska pod nazwą: widać, że otwiera kartę dostawcy, bez krzyku linku w gęstej liście.
                "max-w-full rounded-sm text-left underline decoration-slate-300 underline-offset-[3px] transition-colors duration-150 hover:decoration-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus max-sm:py-1"
              )}
              onClick={() => onOpenSupplier(row.supplierId)}
              title="Otwórz kartę dostawcy"
            >
              {row.supplierName}
            </button>
          ) : (
            <p className={panelTypography.rowTitle}>{row.supplierName}</p>
          )}
          <p className={cn("mt-1 flex flex-wrap items-center gap-x-2 gap-y-1", panelTypography.rowMeta)}>
            {source && SourceIcon ? (
              <Badge className="gap-1">
                <SourceIcon size={12} aria-hidden />
                {DAILY_SUPPLIER_SOURCE_LABEL[source]}
              </Badge>
            ) : null}
            {row.overdueDays > 0 ? (
              <span className="tabular-nums text-amber-800">
                zaległy {row.overdueDays} {polishPluralWord(row.overdueDays, "dzień", "dni", "dni")}
              </span>
            ) : row.schedule ? (
              <span>termin dziś</span>
            ) : null}
            {row.vacationNote ? (
              <Badge variant="warning" className="gap-1">
                <IconSun size={12} aria-hidden />
                {vacationNoteLabel(row.vacationNote)}
              </Badge>
            ) : row.onVacationNow ? (
              <Badge variant="warning" className="gap-1">
                <IconSun size={12} aria-hidden />
                Urlop
              </Badge>
            ) : null}
            {row.requestCount > 0 ? (
              <a
                href={dailyPanelSectionHref("prosby")}
                className="tabular-nums text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
                title="Przejdź do próśb handlowców"
              >
                {row.requestCount} {polishPluralWord(row.requestCount, "prośba", "prośby", "próśb")}
              </a>
            ) : null}
            {row.stockOutCount > 0 ? (
              <a
                href={dailyPanelSectionHref("stockOut")}
                className="tabular-nums text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
                title="Przejdź do sygnałów „brak na stanie”"
              >
                {row.stockOutCount} {polishPluralWord(row.stockOutCount, "sygnał", "sygnały", "sygnałów")} braku
              </a>
            ) : null}
            {staleNote ? <span className="text-amber-800">{staleNote}</span> : null}
          </p>
        </div>
      </div>
      <p className={cn("text-sm tabular-nums sm:text-right", STATUS_TONE_CLASS[status.tone])}>
        {row.automatWarning ? (
          <Badge variant="warning" className="mr-2">
            do sprawdzenia
          </Badge>
        ) : null}
        {status.text}
      </p>
      <div className="flex justify-end">
        <RowAction row={row} run={run} pending={pending} automat={automat} confirmOrdered={confirmOrdered} />
      </div>
      {loadError ? (
        <p className="col-span-2 text-xs text-red-700 sm:col-span-3" role="alert">
          {loadError}
        </p>
      ) : null}
      {open ? (
        <RowDetails
          id={detailsId}
          row={row}
          meta={meta}
          todayKey={todayKey}
          expiresKey={expiresKey}
          run={run}
          pending={pending}
          onOpenSupplier={onOpenSupplier}
          onVacation={onVacation}
          onEdit={onEdit}
          confirmOrdered={confirmOrdered}
        />
      ) : null}
      {orderedToConfirm ? (
        <ConfirmDialog
          open
          title={`Oznaczyć „${row.supplierName}” jako zamówione?`}
          message={`Ten dostawca ma ${stockSignalUrgentLabel(urgentCount)} ${polishPluralWord(urgentCount, "pozycję", "pozycje", "pozycji")} Do ZD w analizie Braki - upewnij się, że ZD jest przygotowane w Subiekcie. Po potwierdzeniu masz 10 sekund na cofnięcie.`}
          confirmLabel="Zamówione"
          onCancel={() => setOrderedToConfirm(null)}
          onConfirm={() => {
            const go = orderedToConfirm;
            setOrderedToConfirm(null);
            go();
          }}
        />
      ) : null}
    </li>
  );
}
