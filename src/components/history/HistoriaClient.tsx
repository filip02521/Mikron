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

  const retentionNote = `Ostatnie ${HISTORY_RETENTION_MONTHS} miesięcy · starsze wpisy kasuje aplikacja przy kolejnych zamówieniach (ok. raz na dobę) — bez crona na serwerze.`;

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
    <div className="space-y-8">
      {msg ? (
        <Toast message={msg.text} tone={msg.tone} onDismiss={() => setMsg(null)} />
      ) : null}

      <p className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-600">
        {retentionNote}
      </p>

      <Card padding={false}>
        <CardHeader
          inset
          title="Historia indywidualna"
          description={`${individual.length} wpisów · bez pozycji informacyjnych · na liście ${Math.min(individual.length, HISTORY_PREVIEW_COUNT)} ostatnich`}
        />
        {!individual.length ? (
          <EmptyState title="Brak wpisów w historii indywidualnej" />
        ) : (
          <>
            <HistoriaIndividualTable
              rows={previewIndividual}
              canManageHistory={canManageHistory}
              pending={pending}
              onRemove={removeIndividual}
            />
            {individual.length > HISTORY_PREVIEW_COUNT ? (
              <div className="border-t border-slate-100 px-6 py-4">
                <Button variant="outline" size="sm" onClick={() => setSheet("individual")}>
                  Pokaż pełną historię ({individual.length} wpisów)
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Card>

      <Card padding={false}>
        <CardHeader
          inset
          title="Zamówienia standardowe"
          description={`${normal.length} akcji w okresie retencji`}
        />
        {!normal.length ? (
          <EmptyState title="Brak historii zamówień standardowych" />
        ) : (
          <>
            <HistoriaNormalTable
              rows={previewNormal}
              canManageHistory={canManageHistory}
              pending={pending}
              onRemove={removeNormal}
            />
            {normal.length > HISTORY_PREVIEW_COUNT ? (
              <div className="border-t border-slate-100 px-6 py-4">
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
        canManageHistory={canManageHistory}
        pending={pending}
        onClose={() => setSheet(null)}
        onRemoveIndividual={removeIndividual}
        onRemoveNormal={removeNormal}
      />
    </div>
  );
}
