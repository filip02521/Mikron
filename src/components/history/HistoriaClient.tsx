"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IndividualOrder } from "@/types/database";
import {
  actionDeleteIndividualHistory,
  actionDeleteNormalHistory,
} from "@/app/actions/admin";
import { HISTORY_PREVIEW_COUNT, HISTORY_RETENTION_MONTHS } from "@/lib/orders/history-retention";
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
import { HistoriaHelp } from "@/components/history/HistoriaHelp";
import { cn } from "@/lib/cn";
import { MICROCOPY } from "@/lib/ui/microcopy";
import { panelChromeInsetClass, panelPageShellClass } from "@/lib/ui/ontime-theme";
import { useAdminPanelPreview } from "@/components/layout/AdminPanelPreviewContext";

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
    <div className={panelPageShellClass}>
      {msg ? (
        <Toast message={msg.text} tone={msg.tone} onDismiss={() => setMsg(null)} />
      ) : null}

      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          leading={
            <SectionHeadingIcon tileClassName="bg-slate-100 text-slate-600">
              <IconArchive size={20} />
            </SectionHeadingIcon>
          }
          title="Historia"
          description={`Audyt zamówień — ostatnie ${HISTORY_RETENTION_MONTHS} miesięcy. Na liście po ${HISTORY_PREVIEW_COUNT} najnowszych wpisów w każdej sekcji.`}
          action={<HistoriaHelp />}
        />

        <SectionListLabel
          domain="panel"
          title="Historia indywidualna"
          hint="Bez pozycji informacyjnych"
          count={individual.length}
          icon={<IconClipboardList size={17} />}
          tileClassName="bg-indigo-100 text-indigo-700"
        />
        {!individual.length ? (
          <EmptyState
            title={MICROCOPY.empty.history.individualTitle}
            description={MICROCOPY.empty.history.description}
          />
        ) : (
          <>
            <HistoriaIndividualTable
              rows={previewIndividual}
              canManageHistory={effectiveCanManage}
              pending={pending}
              onRemove={removeIndividual}
            />
            {individual.length > HISTORY_PREVIEW_COUNT ? (
              <div className={cn("border-t border-slate-100 py-4", panelChromeInsetClass)}>
                <Button variant="outline" size="sm" onClick={() => setSheet("individual")}>
                  Pokaż pełną historię ({individual.length} wpisów)
                </Button>
              </div>
            ) : null}
          </>
        )}

        <div className="border-t border-slate-100">
          <SectionListLabel
            domain="panel"
            title="Zamówienia standardowe"
            hint="Akcje zbiorcze w panelu dziennym"
            count={normal.length}
            icon={<IconArchive size={17} />}
            tileClassName="bg-slate-100 text-slate-600"
          />
        </div>
        {!normal.length ? (
          <EmptyState
            title={MICROCOPY.empty.history.standardTitle}
            description={MICROCOPY.empty.history.description}
          />
        ) : (
          <>
            <HistoriaNormalTable
              rows={previewNormal}
              canManageHistory={effectiveCanManage}
              pending={pending}
              onRemove={removeNormal}
            />
            {normal.length > HISTORY_PREVIEW_COUNT ? (
              <div className={cn("border-t border-slate-100 py-4", panelChromeInsetClass)}>
                <Button variant="outline" size="sm" onClick={() => setSheet("normal")}>
                  Pokaż pełną historię ({normal.length} wpisów)
                </Button>
              </div>
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
