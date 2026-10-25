"use client";
import { HISTORY_TOAST, type ToastNotice, toastFromUnknown } from "@/lib/ui/notice-copy";

import { useMemo, useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { IndividualOrder } from "@/types/database";
import {
  actionDeleteIndividualHistory,
  actionDeleteNormalHistory,
  actionCancelOrder,
  actionUpdateProcurementCancelNote,
} from "@/app/actions/admin";
import { HISTORY_PREVIEW_COUNT, HISTORY_RETENTION_MONTHS } from "@/lib/orders/history-retention";
import { historySectionSummary } from "@/lib/orders/history-ui";
import {
  parseHistoriaBrowseTab,
  parseHistoriaSupplierId,
  type HistoriaBrowseTab,
} from "@/lib/orders/historia-links";
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
import { PageHeader } from "@/components/ui/PageHeader";
import { IconChevronRight } from "@/components/icons/StrokeIcons";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { HistoriaHelp } from "@/components/history/HistoriaHelp";
import { ProcurementCancelDialog } from "@/components/procurement/ProcurementCancelDialog";
import { ProcurementCancelNoteEditModal } from "@/components/procurement/ProcurementCancelNoteEditModal";
import { cn } from "@/lib/cn";
import { MICROCOPY } from "@/lib/ui/microcopy";
import {
  panelChromeInsetClass,
} from "@/lib/ui/ontime-theme";
import { useAdminPanelPreview } from "@/components/layout/AdminPanelPreviewContext";
import { salesHistoriaHeaderHint } from "@/lib/sales/sales-page-ui-copy";
import { askConfirm } from "@/components/ui/ConfirmHost";

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
        Pokaż pełną historię ({total} {polishPluralWord(total, "wpis", "wpisy", "wpisów")})
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
  const searchParams = useSearchParams();
  const { readOnly } = useAdminPanelPreview();
  const effectiveCanManage = canManageHistory && !readOnly;
  const effectiveCanOperate = canOperateOrders && !readOnly;
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ToastNotice | null>(null);
  const [sheet, setSheet] = useState<HistoriaBrowseTab | null>(null);
  const [sheetQuery, setSheetQuery] = useState("");
  const [sheetSupplierId, setSheetSupplierId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<IndividualOrder | null>(null);
  const [editNoteTarget, setEditNoteTarget] = useState<IndividualOrder | null>(null);

  useEffect(() => {
    const tab = parseHistoriaBrowseTab(searchParams.get("tab"));
    if (!tab) return;
    const q = searchParams.get("q")?.trim() ?? "";
    const supplierId = parseHistoriaSupplierId(searchParams.get("supplier"));
    queueMicrotask(() => {
      setSheet(tab);
      setSheetQuery(q);
      setSheetSupplierId(supplierId);
    });
    router.replace("/historia", { scroll: false });
  }, [searchParams, router]);

  const openSheet = (kind: HistoriaBrowseTab, query = "") => {
    setSheetQuery(query);
    setSheetSupplierId(null);
    setSheet(kind);
  };

  const closeSheet = () => {
    setSheet(null);
    setSheetQuery("");
    setSheetSupplierId(null);
  };

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

  const removeIndividual = async (id: string) => {
    if (
      !(await askConfirm({
        title: "Usunąć wpis?",
        message: "Wpis zniknie z historii indywidualnej.",
        confirmLabel: "Usuń",
        danger: true,
      }))
    )
      return;
    start(async () => {
      try {
        await actionDeleteIndividualHistory(id);
        setMsg(HISTORY_TOAST.deletedEntry);
        router.refresh();
      } catch (e) {
        setMsg(toastFromUnknown(e, HISTORY_TOAST.deleteFailed.text));
      }
    });
  };

  const removeNormal = async (id: string) => {
    if (
      !(await askConfirm({
        title: "Usunąć wpis?",
        message: "Wpis zniknie z historii standardowej.",
        confirmLabel: "Usuń",
        danger: true,
      }))
    )
      return;
    start(async () => {
      try {
        await actionDeleteNormalHistory(id);
        setMsg(HISTORY_TOAST.deletedEntry);
        router.refresh();
      } catch (e) {
        setMsg(toastFromUnknown(e, HISTORY_TOAST.deleteFailed.text));
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
        setMsg(toastFromUnknown(e, HISTORY_TOAST.cancelFailed.text));
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
        setMsg(toastFromUnknown(e, HISTORY_TOAST.saveNoteFailed.text));
      }
    });
  };

  return (
    <div className="space-y-6">
      {msg ? (
        <NoticeToast notice={msg} onDismiss={() => setMsg(null)} />
      ) : null}

      <ProcurementCancelDialog
        open={cancelTarget !== null}
        title="Anulować prośbę?"
        headline={cancelTarget?.products}
        message="Prośba zostanie oznaczona jako anulowana. Handlowiec otrzyma powiadomienie e-mail."
        confirmLabel="Anuluj prośbę"
        tier={editNoteTarget ? "stack" : sheet ? "top" : "raised"}
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

      <PageHeader
        title="Historia zamówień"
        help={<HistoriaHelp />}
        description={salesHistoriaHeaderHint(HISTORY_RETENTION_MONTHS, HISTORY_PREVIEW_COUNT)}
        className="mb-0"
      />

      <Card padding={false} className="min-w-0 overflow-hidden">
        <CardHeader
          inset
          density="compact"
          actionAlign="inline"
          title="Prośby indywidualne"
          description={
            individual.length > 0
              ? `${summary.individualTotal} ${polishPluralWord(summary.individualTotal, "prośba", "prośby", "próśb")}${
                  summary.individualOpen > 0
                    ? ` · ${summary.individualOpen} ${polishPluralWord(summary.individualOpen, "otwarta", "otwarte", "otwartych")}`
                    : summary.individualCompleted > 0
                      ? ` · ${summary.individualCompleted} ${polishPluralWord(summary.individualCompleted, "zakończona", "zakończone", "zakończonych")}`
                      : ""
                }. Zrealizowane i zarchiwizowane prośby handlowców, bez pozycji informacyjnych.`
              : "Zrealizowane i zarchiwizowane prośby handlowców, bez pozycji informacyjnych."
          }
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
              <HistoryShowAllFooter
                total={individual.length}
                onOpen={() => openSheet("individual")}
              />
            ) : null}
          </>
        )}
      </Card>

      <Card padding={false} className="min-w-0 overflow-hidden">
        <CardHeader
          inset
          density="compact"
          actionAlign="inline"
          title="Zamówienia standardowe"
          description={`${normal.length > 0 ? `${summary.normalTotal} ${polishPluralWord(summary.normalTotal, "wpis", "wpisy", "wpisów")}. ` : ""}Kliknięcia „Zamówione” i przesunięcia terminów z panelu dziennego.`}
        />
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
              <HistoryShowAllFooter
                total={normal.length}
                onOpen={() => openSheet("normal")}
              />
            ) : null}
          </>
        )}
      </Card>

      <HistoriaBrowseSheet
        key={
          sheet
            ? `${sheet}:${sheetSupplierId ?? ""}:${sheetQuery}`
            : "closed"
        }
        open={sheet !== null}
        kind={sheet ?? "individual"}
        initialQuery={sheetQuery}
        supplierId={sheetSupplierId}
        individual={individual}
        normal={normal}
        canOperateOrders={effectiveCanOperate}
        canManageHistory={effectiveCanManage}
        pending={pending}
        onClose={closeSheet}
        onRemoveIndividual={removeIndividual}
        onRemoveNormal={removeNormal}
        onCancelIndividual={effectiveCanOperate ? cancelOrder : undefined}
        onEditNoteIndividual={effectiveCanOperate ? editNote : undefined}
      />
    </div>
  );
}
