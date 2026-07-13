"use client";
import { HISTORY_TOAST, toastFromError, type ToastNotice } from "@/lib/ui/notice-copy";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IndividualOrder } from "@/types/database";
import {
  actionDeleteIndividualHistory,
  actionDeleteNormalHistory,
  actionCancelOrder,
  actionUpdateProcurementCancelNote,
} from "@/app/actions/admin";
import { HISTORY_PREVIEW_COUNT, HISTORY_RETENTION_MONTHS } from "@/lib/orders/history-retention";
import { historySectionSummary } from "@/lib/orders/history-ui";
import { HistoriaIndividualTable } from "@/components/history/HistoriaIndividualTable";
import {
  HistoriaNormalTable,
  type NormalHistoryRow,
} from "@/components/history/HistoriaNormalTable";
import { HistoriaBrowseSheet } from "@/components/history/HistoriaBrowseSheet";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { SectionListLabel } from "@/components/ui/SectionListLabel";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconArchive, IconClipboardList, IconChevronRight } from "@/components/icons/StrokeIcons";
import { navIconTileClassForTone } from "@/components/icons/NavIcon";
import { HistoriaHelp } from "@/components/history/HistoriaHelp";
import { ProcurementCancelDialog } from "@/components/procurement/ProcurementCancelDialog";
import { ProcurementCancelNoteEditModal } from "@/components/procurement/ProcurementCancelNoteEditModal";
import { cn } from "@/lib/cn";
import { MICROCOPY } from "@/lib/ui/microcopy";
import {
  panelChromeInsetClass,
  procurementArchivePageShellClass,
  panelSectionInsetClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";
import { useAdminPanelPreview } from "@/components/layout/AdminPanelPreviewContext";
import { salesHistoriaHeaderHint } from "@/lib/sales/sales-page-ui-copy";

function HistorySummaryStrip({
  individualTotal,
  individualOpen,
  individualCompleted,
  normalTotal,
}: ReturnType<typeof historySectionSummary>) {
  return (
    <div
      className={cn(
        "grid gap-2 border-b border-slate-100 bg-slate-50/35 sm:grid-cols-2",
        panelSectionInsetClass,
        "py-3"
      )}
    >
      <div className="flex items-center gap-3 rounded-md border border-indigo-100/80 bg-white px-3 py-2.5 shadow-sm">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-indigo-700">
          <IconClipboardList size={16} />
        </div>
        <div className="min-w-0">
          <p className={panelTypography.caption}>Prośby indywidualne</p>
          <p className={cn(panelTypography.rowTitle, "mt-0.5 tabular-nums")}>
            {individualTotal}
            <span className="ml-1.5 text-sm font-normal text-slate-500">
              {individualOpen > 0
                ? `· ${individualOpen} otwartych`
                : individualCompleted > 0
                  ? `· ${individualCompleted} zakończonych`
                  : ""}
            </span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-md border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
          <IconArchive size={16} />
        </div>
        <div className="min-w-0">
          <p className={panelTypography.caption}>Akcje standardowe</p>
          <p className={cn(panelTypography.rowTitle, "mt-0.5 tabular-nums")}>
            {normalTotal}
            <span className="ml-1.5 text-sm font-normal text-slate-500">
              · zbiorcze w panelu dziennym
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function HistoryShowAllFooter({
  total,
  onOpen,
}: {
  total: number;
  onOpen: () => void;
}) {
  return (
    <div className={cn("border-t border-slate-100 py-3", panelChromeInsetClass)}>
      <Button variant="outline" size="sm" className="gap-1.5 w-full sm:w-auto" onClick={onOpen}>
        <IconChevronRight size={14} className="shrink-0" />
        Pokaż pełną historię ({total} {total === 1 ? "wpis" : "wpisów"})
      </Button>
    </div>
  );
}

export function HistoriaClient({
  individual,
  normal,
  canManageHistory = false,
  canOperateOrders = false,
}: {
  individual: IndividualOrder[];
  normal: NormalHistoryRow[];
  canManageHistory?: boolean;
  canOperateOrders?: boolean;
}) {
  const router = useRouter();
  const { readOnly } = useAdminPanelPreview();
  const effectiveCanManage = canManageHistory && !readOnly;
  const effectiveCanOperate = canOperateOrders && !readOnly;
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ToastNotice | null>(null);
  const [sheet, setSheet] = useState<"individual" | "normal" | null>(null);
  const [cancelTarget, setCancelTarget] = useState<IndividualOrder | null>(null);
  const [editNoteTarget, setEditNoteTarget] = useState<IndividualOrder | null>(null);

  const previewIndividual = useMemo(
    () => individual.slice(0, HISTORY_PREVIEW_COUNT),
    [individual]
  );
  const previewNormal = useMemo(
    () => normal.slice(0, HISTORY_PREVIEW_COUNT),
    [normal]
  );
  const summary = useMemo(
    () => historySectionSummary(individual, normal.length),
    [individual, normal.length]
  );

  const removeIndividual = (id: string) => {
    if (!confirm("Usunąć ten wpis z historii indywidualnej?")) return;
    start(async () => {
      try {
        await actionDeleteIndividualHistory(id);
        setMsg(HISTORY_TOAST.deletedEntry);
        router.refresh();
      } catch (e) {
        setMsg(toastFromError(e instanceof Error ? e.message : undefined, HISTORY_TOAST.deleteFailed.text));
      }
    });
  };

  const removeNormal = (id: string) => {
    if (!confirm("Usunąć ten wpis z historii standardowej?")) return;
    start(async () => {
      try {
        await actionDeleteNormalHistory(id);
        setMsg(HISTORY_TOAST.deletedEntry);
        router.refresh();
      } catch (e) {
        setMsg(toastFromError(e instanceof Error ? e.message : undefined, HISTORY_TOAST.deleteFailed.text));
      }
    });
  };

  const emailWarning = (result: { emailError?: string }) => result.emailError;

  const cancelOrder = (order: IndividualOrder) => {
    setCancelTarget(order);
  };

  const confirmCancelOrder = (note: string | undefined) => {
    if (!cancelTarget) return;
    const target = cancelTarget;
    start(async () => {
      try {
        const result = await actionCancelOrder(target.id, note);
        setCancelTarget(null);
        setMsg(HISTORY_TOAST.cancelledOrder(emailWarning(result)));
        router.refresh();
      } catch (e) {
        setMsg(toastFromError(e instanceof Error ? e.message : undefined, HISTORY_TOAST.cancelFailed.text));
      }
    });
  };

  const editNote = (order: IndividualOrder) => {
    setEditNoteTarget(order);
  };

  const confirmEditNote = (note: string | undefined) => {
    if (!editNoteTarget) return;
    const target = editNoteTarget;
    start(async () => {
      try {
        const result = await actionUpdateProcurementCancelNote(target.id, note);
        setEditNoteTarget(null);
        setMsg(HISTORY_TOAST.savedNote(emailWarning(result)));
        router.refresh();
      } catch (e) {
        setMsg(toastFromError(e instanceof Error ? e.message : undefined, HISTORY_TOAST.saveNoteFailed.text));
      }
    });
  };

  return (
    <div className={procurementArchivePageShellClass}>
      {msg ? (
        <NoticeToast notice={msg} onDismiss={() => setMsg(null)} />
      ) : null}

      <ProcurementCancelDialog
        open={cancelTarget !== null}
        title="Anulować prośbę?"
        headline={cancelTarget?.products}
        message="Prośba zostanie oznaczona jako anulowana. Handlowiec otrzyma powiadomienie e-mail."
        confirmLabel="Anuluj prośbę"
        tier={editNoteTarget ? "stack" : "raised"}
        pending={pending && cancelTarget !== null}
        onCancel={() => setCancelTarget(null)}
        onConfirm={confirmCancelOrder}
      />
      <ProcurementCancelNoteEditModal
        open={editNoteTarget !== null}
        initialNote={editNoteTarget?.procurement_cancel_note}
        pending={pending && editNoteTarget !== null}
        onCancel={() => setEditNoteTarget(null)}
        onConfirm={confirmEditNote}
      />

      <Card padding={false} className="min-w-0 overflow-hidden">
        <CardHeader
          inset
          density="compact"
          leading={
            <SectionHeadingIcon tileClassName={navIconTileClassForTone("slate")}>
              <IconArchive size={20} />
            </SectionHeadingIcon>
          }
          title="Historia"
          hint={salesHistoriaHeaderHint(HISTORY_RETENTION_MONTHS, HISTORY_PREVIEW_COUNT)}
          hintAriaLabel="O historii zamówień"
          action={<HistoriaHelp />}
        />

        {summary.individualTotal > 0 || summary.normalTotal > 0 ? (
          <HistorySummaryStrip {...summary} />
        ) : null}

        <SectionListLabel
          domain="panel"
          accent="indigo"
          title="Historia indywidualna"
          hint="Zrealizowane i zarchiwizowane prośby handlowców — bez pozycji informacyjnych"
          hintMode="tooltip"
          count={individual.length}
          icon={<IconClipboardList size={17} />}
          tileClassName="bg-indigo-100 text-indigo-800"
        />
        {!individual.length ? (
          <div className={panelChromeInsetClass}>
            <EmptyState
              title={MICROCOPY.empty.history.individualTitle}
              description={MICROCOPY.empty.history.description}
            />
          </div>
        ) : (
          <>
            <HistoriaIndividualTable
              rows={previewIndividual}
              canOperateOrders={effectiveCanOperate}
              canManageHistory={effectiveCanManage}
              pending={pending}
              onCancel={effectiveCanOperate ? cancelOrder : undefined}
              onEditNote={effectiveCanOperate ? editNote : undefined}
              onRemove={removeIndividual}
            />
            {individual.length > HISTORY_PREVIEW_COUNT ? (
              <HistoryShowAllFooter total={individual.length} onOpen={() => setSheet("individual")} />
            ) : null}
          </>
        )}

        <div className="border-t border-slate-100">
          <SectionListLabel
            domain="panel"
            accent="slate"
            title="Zamówienia standardowe"
            hint="Kliknięcia „Zamówione” i przesunięcia terminów z panelu dziennego"
            hintMode="tooltip"
            count={normal.length}
            icon={<IconArchive size={17} />}
            tileClassName="bg-slate-100 text-slate-700"
          />
        </div>
        {!normal.length ? (
          <div className={panelChromeInsetClass}>
            <EmptyState
              title={MICROCOPY.empty.history.standardTitle}
              description={MICROCOPY.empty.history.description}
            />
          </div>
        ) : (
          <>
            <HistoriaNormalTable
              rows={previewNormal}
              canManageHistory={effectiveCanManage}
              pending={pending}
              onRemove={removeNormal}
            />
            {normal.length > HISTORY_PREVIEW_COUNT ? (
              <HistoryShowAllFooter total={normal.length} onOpen={() => setSheet("normal")} />
            ) : null}
          </>
        )}
      </Card>

      <HistoriaBrowseSheet
        open={sheet !== null}
        kind={sheet ?? "individual"}
        individual={individual}
        normal={normal}
        canOperateOrders={effectiveCanOperate}
        canManageHistory={effectiveCanManage}
        pending={pending}
        onClose={() => setSheet(null)}
        onRemoveIndividual={removeIndividual}
        onRemoveNormal={removeNormal}
        onCancelIndividual={effectiveCanOperate ? cancelOrder : undefined}
        onEditNoteIndividual={effectiveCanOperate ? editNote : undefined}
      />
    </div>
  );
}
