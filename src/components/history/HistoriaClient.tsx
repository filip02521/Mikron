"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IndividualOrder } from "@/types/database";
import {
  actionDeleteIndividualHistory,
  actionDeleteNormalHistory,
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
import { Toast } from "@/components/ui/Toast";
import { SectionListLabel } from "@/components/ui/SectionListLabel";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconArchive, IconClipboardList } from "@/components/icons/StrokeIcons";
import { navIconTileClassForTone } from "@/components/icons/NavIcon";
import { HistoriaHelp } from "@/components/history/HistoriaHelp";
import { cn } from "@/lib/cn";
import { MICROCOPY } from "@/lib/ui/microcopy";
import {
  panelChromeInsetClass,
  procurementArchivePageShellClass,
  panelSectionInsetClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";
import { useAdminPanelPreview } from "@/components/layout/AdminPanelPreviewContext";

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
      <div className="rounded-md border border-indigo-100/80 bg-white px-3 py-2.5 shadow-sm">
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
      <div className="rounded-md border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm">
        <p className={panelTypography.caption}>Akcje standardowe</p>
        <p className={cn(panelTypography.rowTitle, "mt-0.5 tabular-nums")}>
          {normalTotal}
          <span className="ml-1.5 text-sm font-normal text-slate-500">
            · zbiorcze w panelu dziennym
          </span>
        </p>
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
      <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={onOpen}>
        Pokaż pełną historię ({total} {total === 1 ? "wpis" : "wpisów"})
      </Button>
    </div>
  );
}

export function HistoriaClient({
  individual,
  normal,
  canManageHistory = false,
}: {
  individual: IndividualOrder[];
  normal: NormalHistoryRow[];
  canManageHistory?: boolean;
}) {
  const router = useRouter();
  const { readOnly } = useAdminPanelPreview();
  const effectiveCanManage = canManageHistory && !readOnly;
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const [sheet, setSheet] = useState<"individual" | "normal" | null>(null);

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
        setMsg({ text: "Wpis usunięty.", tone: "success" });
        router.refresh();
      } catch (e) {
        setMsg({
          text: e instanceof Error ? e.message : "Błąd usuwania",
          tone: "error",
        });
      }
    });
  };

  const removeNormal = (id: string) => {
    if (!confirm("Usunąć ten wpis z historii standardowej?")) return;
    start(async () => {
      try {
        await actionDeleteNormalHistory(id);
        setMsg({ text: "Wpis usunięty.", tone: "success" });
        router.refresh();
      } catch (e) {
        setMsg({
          text: e instanceof Error ? e.message : "Błąd usuwania",
          tone: "error",
        });
      }
    });
  };

  return (
    <div className={procurementArchivePageShellClass}>
      {msg ? (
        <Toast message={msg.text} tone={msg.tone} onDismiss={() => setMsg(null)} />
      ) : null}

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
          description={`Audyt zamówień z ostatnich ${HISTORY_RETENTION_MONTHS} miesięcy. Na liście — ${HISTORY_PREVIEW_COUNT} najnowszych wpisów w każdej sekcji; resztę otworzysz z wyszukiwaniem.`}
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
              canManageHistory={effectiveCanManage}
              pending={pending}
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
        canManageHistory={effectiveCanManage}
        pending={pending}
        onClose={() => setSheet(null)}
        onRemoveIndividual={removeIndividual}
        onRemoveNormal={removeNormal}
      />
    </div>
  );
}
