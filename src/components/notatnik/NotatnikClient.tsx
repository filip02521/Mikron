"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSalesOnboardingDemo } from "@/components/sales/SalesOnboardingContext";
import { buildOnboardingNotepadDemo } from "@/lib/sales/sales-onboarding-demo-data";
import { Card, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { UndoToast } from "@/components/ui/UndoToast";
import { IconNotepad, IconPackageCheck, IconArchive, IconClipboardPen } from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { sectionIconTileBrandClass, salesChromeInsetClass } from "@/lib/ui/ontime-theme";
import { uniqueById } from "@/lib/sales/notepad-list";
import { sortZkWatches } from "@/lib/sales/zk-watch-sort";
import { watchNeedsNotepadAttention } from "@/lib/sales/notepad-follow-up";
import {
  computeZkWatchOrderHints,
  type ZkWatchOrderHints,
} from "@/lib/sales/zk-watch-order-link";
import { sortSalesNotes } from "@/lib/sales/notepad-note-sort";
import type { NotepadTodayTaskKind } from "@/lib/sales/notepad-today-tasks";
import type { SalesNotepadData } from "@/lib/data/sales-notepad";
import type { SubiektAvailability } from "@/lib/subiekt/availability";
import type { SalesNote, SalesZkWatch } from "@/types/database";
import {
  actionReorderSalesNotes,
  actionRestoreSalesNote,
} from "@/app/actions/sales-notepad";
import { SubiektStatusBar } from "@/components/subiekt/SubiektStatusBar";
import { ZkWatchSection } from "./ZkWatchSection";
import { ZkWatchCard } from "./ZkWatchCard";
import { NotesSection } from "./NotesSection";
import { ArchivedNotesSection } from "./ArchivedNotesSection";
import { TodayTasksSection } from "./TodayTasksSection";
import { NotatnikPanel } from "./NotatnikPanel";
import { NotatnikCollapsible } from "./NotatnikCollapsible";
import { NOTATNIK_PAGE_CLASS, NOTATNIK_ZK_LIST_CLASS } from "./notatnik-layout";
import { ManagerPreviewBanner } from "@/components/sales/ManagerPreviewBanner";
import { mojeShipmentSectionShellClass } from "@/lib/ui/moje-shipment-row-styles";
import { undoWindowBannerDescription } from "@/lib/orders/daily-panel-undo";
import { cn } from "@/lib/cn";

type NotatnikUndoState =
  | { type: "archive"; note: SalesNote }
  | { type: "reorder"; notes: SalesNote[] };

const NOTATNIK_INTRO =
  "Wpisz numer zamówienia klienta (ZK) — dane wczytają się automatycznie. Notatki i archiwum w jednym miejscu.";

function contextualizeSubiektMessage(message: string): string {
  return message
    .replace(/Subiekt: offline/g, "System magazynowy niedostępny")
    .replace(/Subiekt: wyłączony/g, "Połączenie z systemem magazynowym wyłączone")
    .replace(/Subiekt niedostępny/g, "System magazynowy niedostępny")
    .replace(/danych z Subiekta/g, "danych z systemu")
    .replace(/z Subiekta/g, "z systemu")
    .replace(
      /terminy bez danych z systemu, zostają szacunki z historii dostaw\./g,
      "automatyczne wczytywanie danych ZK może być niedostępne — wpisz numer ręcznie."
    )
    .replace(
      /terminy z dokumentów ZD nie są pobierane, zostają szacunki z historii dostaw\./g,
      "automatyczne wczytywanie danych może być niedostępne."
    )
    .replace(
      /terminy ZD \(tylko u powiązanego dostawcy\) odświeżamy co ok\. 2 godziny\./g,
      "dane produktów odświeżamy co ok. 2 godziny."
    );
}

function flashAnchor(anchor: string) {
  window.setTimeout(() => {
    const el = document.getElementById(anchor);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-indigo-400/70", "ring-offset-2", "rounded-md");
    window.setTimeout(() => {
      el.classList.remove("ring-2", "ring-indigo-400/70", "ring-offset-2", "rounded-md");
    }, 1200);
  }, 120);
}

export function NotatnikClient({
  initial,
  readOnly,
  pageTitle,
  pageDescription,
  subiektAvailability,
  linkError = null,
  loadError = null,
  teamPreview = null,
}: {
  initial: SalesNotepadData;
  readOnly?: boolean;
  pageTitle: string;
  pageDescription?: string;
  subiektAvailability?: SubiektAvailability;
  linkError?: string | null;
  loadError?: string | null;
  teamPreview?: {
    salesPersonId: string;
    salesPersonName: string;
    readOnly?: boolean;
  } | null;
}) {
  const router = useRouter();
  const tourDemo = useSalesOnboardingDemo("notatnik");
  const demoInitial = useMemo(
    () => buildOnboardingNotepadDemo(initial.notes[0]?.sales_person_id ?? "onboarding-demo"),
    [initial.notes]
  );
  const source = tourDemo ? demoInitial : initial;
  const zkLinkableOrders = source.zkLinkableOrders;
  /** W tourze pokazujemy pełny UI kart ZK (kliknięcia i tak blokuje warstwa touru). */
  const effectiveReadOnly = tourDemo ? false : Boolean(readOnly);
  const [zkWatches, setZkWatches] = useState(source.zkWatches);
  const [archivedWatches, setArchivedWatches] = useState(source.archivedZkWatches);
  const [notes, setNotes] = useState(source.notes);
  const [archivedNotes, setArchivedNotes] = useState(source.archivedNotes);
  const [showZk, setShowZk] = useState(
    () => tourDemo || source.zkWatches.some((w) => watchNeedsNotepadAttention(w))
  );
  const [showArchive, setShowArchive] = useState(false);
  const [undo, setUndo] = useState<NotatnikUndoState | null>(null);
  const dismissUndo = useCallback(() => setUndo(null), []);

  const zkHintsByWatchId = useMemo(() => {
    const map = new Map<string, ZkWatchOrderHints>();
    for (const watch of zkWatches) {
      map.set(watch.id, computeZkWatchOrderHints(watch, zkLinkableOrders));
    }
    return map;
  }, [zkWatches, zkLinkableOrders]);

  const subiektForNotepad = useMemo(() => {
    if (!subiektAvailability) return undefined;
    return {
      ...subiektAvailability,
      message: contextualizeSubiektMessage(subiektAvailability.message),
    };
  }, [
    subiektAvailability?.configured,
    subiektAvailability?.reachable,
    subiektAvailability?.checkedAt,
    subiektAvailability?.shortLabel,
    subiektAvailability?.message,
  ]);
  const [subiektStatus, setSubiektStatus] = useState<SubiektAvailability | undefined>(
    subiektForNotepad
  );

  const handleSubiektStatusChange = useCallback((status: SubiektAvailability) => {
    setSubiektStatus({
      ...status,
      message: contextualizeSubiektMessage(status.message),
    });
  }, []);

  useEffect(() => {
    setSubiektStatus(subiektForNotepad);
  }, [
    subiektAvailability?.configured,
    subiektAvailability?.reachable,
    subiektAvailability?.checkedAt,
    subiektAvailability?.shortLabel,
    subiektAvailability?.message,
  ]);

  useEffect(() => {
    const next = tourDemo ? demoInitial : initial;
    setZkWatches(uniqueById(sortZkWatches(next.zkWatches)));
    setArchivedWatches(uniqueById(next.archivedZkWatches));
    setNotes(uniqueById(next.notes));
    setArchivedNotes(uniqueById(next.archivedNotes));
    if (tourDemo) setShowZk(true);
  }, [
    demoInitial,
    initial,
    tourDemo,
    initial.zkWatches,
    initial.archivedZkWatches,
    initial.notes,
    initial.archivedNotes,
  ]);

  useEffect(() => {
    if (!undo || effectiveReadOnly) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        void handleUndo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, effectiveReadOnly]);

  function refresh() {
    router.refresh();
  }

  async function handleUndo() {
    if (!undo) return;
    const snapshot = undo;
    setUndo(null);
    try {
      if (snapshot.type === "archive") {
        const { note } = await actionRestoreSalesNote(snapshot.note.id);
        setArchivedNotes((prev) => prev.filter((n) => n.id !== snapshot.note.id));
        setNotes((prev) => uniqueById([note, ...prev]));
        flashAnchor(`note-${note.id}`);
      } else {
        const ids = sortSalesNotes(snapshot.notes).map((n) => n.id);
        await actionReorderSalesNotes(ids);
        setNotes(uniqueById(snapshot.notes));
      }
      refresh();
    } catch {
      setUndo(snapshot);
    }
  }

  function handleTodayTaskClick(anchor: string, kind: NotepadTodayTaskKind) {
    if (kind === "zk-follow-up") {
      setShowZk(true);
    }
    flashAnchor(anchor);
  }

  function handleWatchAdded(watch: SalesZkWatch) {
    setZkWatches((prev) => uniqueById(sortZkWatches([watch, ...prev])));
    setArchivedWatches((prev) => prev.filter((w) => w.id !== watch.id));
    setShowZk(true);
    refresh();
    flashAnchor(`watch-${watch.id}`);
  }

  function handleWatchClosed(watchId: string) {
    const now = new Date().toISOString();
    setZkWatches((prev) => {
      const watch = prev.find((w) => w.id === watchId);
      if (watch) {
        setArchivedWatches((archived) =>
          uniqueById([{ ...watch, closed_at: now, updated_at: now }, ...archived])
        );
      }
      return prev.filter((w) => w.id !== watchId);
    });
    setShowArchive(true);
    refresh();
  }

  function handleWatchRestored(watch: SalesZkWatch) {
    setArchivedWatches((prev) => prev.filter((w) => w.id !== watch.id));
    setZkWatches((prev) => uniqueById(sortZkWatches([watch, ...prev])));
    setShowZk(true);
    refresh();
  }

  function handleWatchRefreshed(watch: SalesZkWatch) {
    setZkWatches((prev) =>
      uniqueById(sortZkWatches(prev.map((w) => (w.id === watch.id ? watch : w))))
    );
    refresh();
  }

  function handleNoteCreated(note: SalesNote) {
    setNotes((prev) => uniqueById([note, ...prev]));
    refresh();
    flashAnchor(`note-${note.id}`);
  }

  function handleNoteUpdated(note: SalesNote) {
    setNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)));
    refresh();
  }

  function handleNotesReordered(next: SalesNote[], previousForUndo?: SalesNote[]) {
    setNotes(uniqueById(next));
    if (previousForUndo) {
      setUndo({ type: "reorder", notes: previousForUndo });
    }
  }

  function handleNoteArchived(note: SalesNote) {
    const now = new Date().toISOString();
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    setArchivedNotes((archived) =>
      uniqueById([{ ...note, archived_at: now, updated_at: now }, ...archived])
    );
    setShowArchive(false);
    setUndo({ type: "archive", note });
    refresh();
  }

  function handleNoteRestored(note: SalesNote) {
    setArchivedNotes((prev) => prev.filter((n) => n.id !== note.id));
    setNotes((prev) => uniqueById([note, ...prev]));
    refresh();
  }

  function handleWatchDeleted(watchId: string) {
    setArchivedWatches((prev) => prev.filter((w) => w.id !== watchId));
    refresh();
  }

  function handleNoteDeleted(noteId: string) {
    setArchivedNotes((prev) => prev.filter((n) => n.id !== noteId));
    refresh();
  }

  const hasArchive = archivedWatches.length > 0 || archivedNotes.length > 0;
  const archiveCount = archivedWatches.length + archivedNotes.length;
  const followUpZkCount = zkWatches.filter((w) => watchNeedsNotepadAttention(w)).length;

  const undoTitle =
    undo?.type === "archive"
      ? `Zarchiwizowano: „${undo.note.title?.trim() || undo.note.body.trim().slice(0, 48) || "Notatka"}”`
      : undo?.type === "reorder"
        ? "Zmieniono kolejność notatek"
        : "";
  const undoDescription = undo ? undoWindowBannerDescription() : "";

  return (
    <div className={NOTATNIK_PAGE_CLASS}>
      {undo && !effectiveReadOnly ? (
        <UndoToast
          title={undoTitle}
          description={undoDescription}
          placement="inline"
          onDismiss={dismissUndo}
          onUndo={() => void handleUndo()}
          undoShortcut="Ctrl+Z"
        />
      ) : null}
      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title={pageTitle}
          description={pageDescription ?? NOTATNIK_INTRO}
          leading={
            <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
              <IconNotepad size={20} />
            </SectionHeadingIcon>
          }
        />

        {teamPreview ? (
          <ManagerPreviewBanner
            salesPersonId={teamPreview.salesPersonId}
            salesPersonName={teamPreview.salesPersonName}
            notatnikPreview
            readOnly={teamPreview.readOnly}
            className={cn(salesChromeInsetClass, "mt-3 text-xs leading-relaxed")}
          />
        ) : null}

        {linkError ? (
          <Alert tone="error" className={cn(salesChromeInsetClass, "mt-3")}>
            {linkError}
          </Alert>
        ) : null}

        {loadError ? (
          <Alert tone="error" className={cn(salesChromeInsetClass, "mt-3")}>
            {loadError}
          </Alert>
        ) : null}

        {subiektForNotepad ? (
          <SubiektStatusBar
            initial={subiektForNotepad}
            onStatusChange={handleSubiektStatusChange}
            embedded
          />
        ) : null}

        {source.zkOrdersMigrationMissing && !tourDemo ? (
          <Alert tone="warning" className="mx-3 mt-3 sm:mx-4">
            Powiązanie ZK z prośbami wymaga migracji bazy:{" "}
            <code className="text-[0.85em]">052_individual_orders_sales_client_kh_id</code>,{" "}
            <code className="text-[0.85em]">055_individual_orders_source_zk</code>.
            Uruchom migracje Supabase — bez nich podpowiedzi i badge „Prośba w toku” mogą nie działać.
          </Alert>
        ) : null}

        <TodayTasksSection
          watches={zkWatches}
          notes={notes}
          onTaskClick={handleTodayTaskClick}
          embedded
        />

        <div className="space-y-3 p-3 sm:p-4">
          <NotatnikPanel
            title="Notatki"
            description="Własne przypomnienia i krótkie wpisy — nie trafiają do działu zakupów."
            count={notes.length || undefined}
            icon={<IconClipboardPen size={17} />}
          >
            <NotesSection
              notes={notes}
              readOnly={effectiveReadOnly}
              embedded
              onNoteCreated={handleNoteCreated}
              onNoteUpdated={handleNoteUpdated}
              onNoteArchived={handleNoteArchived}
              onNotesReordered={handleNotesReordered}
            />
          </NotatnikPanel>

          <NotatnikCollapsible
            title="Czeka na towar"
            description="Krótki numer (min. 2 znaki) szuka w ostatnich 30 dniach; pełny np. 234/M/03/2026 — tylko dany miesiąc."
            count={zkWatches.length || undefined}
            open={showZk}
            highlight={followUpZkCount > 0}
            icon={<IconPackageCheck size={17} />}
            tileClassName="bg-amber-100 text-amber-800"
            badge={
              followUpZkCount > 0 ? (
                <Badge variant="purple" className="text-[10px]">
                  {followUpZkCount}{" "}
                  {followUpZkCount === 1
                    ? "przypomnienie"
                    : followUpZkCount < 5
                      ? "przypomnienia"
                      : "przypomnień"}
                </Badge>
              ) : null
            }
            onToggle={() => setShowZk((v) => !v)}
          >
            <ZkWatchSection
              watches={zkWatches}
              zkHintsByWatchId={zkHintsByWatchId}
              readOnly={effectiveReadOnly}
              tourPreview={tourDemo}
              embedded
              compact={!tourDemo}
              subiektReachable={tourDemo ? true : (subiektStatus?.reachable ?? false)}
              subiektBlockedHint={
                subiektStatus && !subiektStatus.reachable
                  ? `${contextualizeSubiektMessage(subiektStatus.message)} Dodawanie ZK będzie możliwe po przywróceniu połączenia.`
                  : undefined
              }
              onWatchAdded={tourDemo ? undefined : handleWatchAdded}
              onWatchClosed={tourDemo ? undefined : handleWatchClosed}
              onWatchRefreshed={tourDemo ? undefined : handleWatchRefreshed}
            />
          </NotatnikCollapsible>

          {hasArchive ? (
            <NotatnikCollapsible
              title="Archiwum"
              description="Zamknięte ZK i zarchiwizowane notatki."
              count={archiveCount || undefined}
              open={showArchive}
              onToggle={() => setShowArchive((v) => !v)}
              icon={<IconArchive size={17} />}
              tileClassName="bg-slate-100 text-slate-600"
            >
              <div className="space-y-4">
                {archivedWatches.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-600">ZK zamknięte</p>
                    <div className={mojeShipmentSectionShellClass}>
                      <ul className={NOTATNIK_ZK_LIST_CLASS}>
                        {archivedWatches.map((watch) => (
                          <li key={watch.id} id={`watch-${watch.id}`}>
                            <ZkWatchCard
                              watch={watch}
                              readOnly={effectiveReadOnly}
                              archived
                              compact
                              onRestored={handleWatchRestored}
                              onDeleted={() => handleWatchDeleted(watch.id)}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
                {archivedNotes.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-600">Notatki</p>
                    <ArchivedNotesSection
                      notes={archivedNotes}
                      readOnly={effectiveReadOnly}
                      onRestored={handleNoteRestored}
                      onDeleted={handleNoteDeleted}
                    />
                  </div>
                ) : null}
              </div>
            </NotatnikCollapsible>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
