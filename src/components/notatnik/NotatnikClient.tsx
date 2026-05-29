"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { UndoToast } from "@/components/ui/UndoToast";
import { uniqueById } from "@/lib/sales/notepad-list";
import { sortPaymentWatches, isPaymentWatchOverdue } from "@/lib/sales/payment-watch-sort";
import { sortSalesNotes } from "@/lib/sales/notepad-note-sort";
import type { NotepadTodayTaskKind } from "@/lib/sales/notepad-today-tasks";
import type { SalesNotepadData } from "@/lib/data/sales-notepad";
import type { SubiektAvailability } from "@/lib/subiekt/availability";
import type { SalesNote, SalesPaymentWatch } from "@/types/database";
import {
  actionReorderSalesNotes,
  actionRestoreSalesNote,
} from "@/app/actions/sales-notepad";
import { SubiektStatusBar } from "@/components/subiekt/SubiektStatusBar";
import { PaymentWatchSection } from "./PaymentWatchSection";
import { PaymentWatchCard } from "./PaymentWatchCard";
import { NotesSection } from "./NotesSection";
import { ArchivedNotesSection } from "./ArchivedNotesSection";
import { TodayTasksSection } from "./TodayTasksSection";
import { NotatnikPanel } from "./NotatnikPanel";
import { NotatnikCollapsible } from "./NotatnikCollapsible";

type NotatnikUndoState =
  | { type: "archive"; note: SalesNote }
  | { type: "reorder"; notes: SalesNote[] };

function contextualizeSubiektMessage(message: string): string {
  return message
    .replace(/dokumentów ZD/g, "danych ZK")
    .replace(
      /terminy bez danych z Subiekta, zostają szacunki z historii dostaw\./g,
      "dodawanie ZK i odświeżanie danych z Subiekta może być niedostępne."
    )
    .replace(
      /terminy z dokumentów ZD nie są pobierane, zostają szacunki z historii dostaw\./g,
      "pobieranie danych ZK z Subiekta jest niedostępne."
    );
}

function flashAnchor(anchor: string) {
  window.setTimeout(() => {
    const el = document.getElementById(anchor);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-indigo-400/70", "ring-offset-2", "rounded-lg");
    window.setTimeout(() => {
      el.classList.remove("ring-2", "ring-indigo-400/70", "ring-offset-2", "rounded-lg");
    }, 1200);
  }, 120);
}

export function NotatnikClient({
  initial,
  readOnly,
  pageTitle,
  pageDescription,
  subiektAvailability,
}: {
  initial: SalesNotepadData;
  readOnly?: boolean;
  pageTitle: string;
  pageDescription?: string;
  subiektAvailability?: SubiektAvailability;
}) {
  const router = useRouter();
  const [paymentWatches, setPaymentWatches] = useState(initial.paymentWatches);
  const [archivedWatches, setArchivedWatches] = useState(initial.archivedPaymentWatches);
  const [notes, setNotes] = useState(initial.notes);
  const [archivedNotes, setArchivedNotes] = useState(initial.archivedNotes);
  const [showZk, setShowZk] = useState(() =>
    initial.paymentWatches.some((w) => isPaymentWatchOverdue(w))
  );
  const [showArchive, setShowArchive] = useState(false);
  const [undo, setUndo] = useState<NotatnikUndoState | null>(null);

  useEffect(() => {
    setPaymentWatches(uniqueById(sortPaymentWatches(initial.paymentWatches)));
    setArchivedWatches(uniqueById(initial.archivedPaymentWatches));
    setNotes(uniqueById(initial.notes));
    setArchivedNotes(uniqueById(initial.archivedNotes));
  }, [
    initial.paymentWatches,
    initial.archivedPaymentWatches,
    initial.notes,
    initial.archivedNotes,
  ]);

  useEffect(() => {
    if (!undo || readOnly) return;
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
  }, [undo, readOnly]);

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
    if (kind === "zk-overdue" || kind === "zk-follow-up") {
      setShowZk(true);
    }
    flashAnchor(anchor);
  }

  function handleWatchAdded(watch: SalesPaymentWatch) {
    setPaymentWatches((prev) => uniqueById(sortPaymentWatches([watch, ...prev])));
    setArchivedWatches((prev) => prev.filter((w) => w.id !== watch.id));
    setShowZk(true);
    refresh();
    flashAnchor(`watch-${watch.id}`);
  }

  function handleWatchSettled(watchId: string) {
    const now = new Date().toISOString();
    setPaymentWatches((prev) => {
      const watch = prev.find((w) => w.id === watchId);
      if (watch) {
        setArchivedWatches((archived) =>
          uniqueById([{ ...watch, settled_at: now, updated_at: now }, ...archived])
        );
      }
      return prev.filter((w) => w.id !== watchId);
    });
    setShowArchive(true);
    refresh();
  }

  function handleWatchRestored(watch: SalesPaymentWatch) {
    setArchivedWatches((prev) => prev.filter((w) => w.id !== watch.id));
    setPaymentWatches((prev) => uniqueById(sortPaymentWatches([watch, ...prev])));
    setShowZk(true);
    refresh();
  }

  function handleWatchRefreshed(watch: SalesPaymentWatch) {
    setPaymentWatches((prev) =>
      uniqueById(sortPaymentWatches(prev.map((w) => (w.id === watch.id ? watch : w))))
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

  const subiektForNotepad = subiektAvailability
    ? {
        ...subiektAvailability,
        message: contextualizeSubiektMessage(subiektAvailability.message),
      }
    : undefined;

  const hasArchive = archivedWatches.length > 0 || archivedNotes.length > 0;
  const archiveCount = archivedWatches.length + archivedNotes.length;
  const overdueZkCount = paymentWatches.filter((w) => isPaymentWatchOverdue(w)).length;

  const undoMessage =
    undo?.type === "archive"
      ? `Zarchiwizowano: „${undo.note.title?.trim() || undo.note.body.trim().slice(0, 48) || "Notatka"}”. Masz 5 sekund na cofnięcie.`
      : undo?.type === "reorder"
        ? "Zmieniono kolejność notatek. Masz 5 sekund na cofnięcie."
        : "";

  return (
    <div className="space-y-4 pb-8">
      <PageHeader title={pageTitle} description={pageDescription} />

      {subiektForNotepad ? <SubiektStatusBar initial={subiektForNotepad} /> : null}

      <TodayTasksSection watches={paymentWatches} notes={notes} onTaskClick={handleTodayTaskClick} />

      <NotatnikPanel title="Notatki">
        <NotesSection
          notes={notes}
          readOnly={readOnly}
          embedded
          onNoteCreated={handleNoteCreated}
          onNoteUpdated={handleNoteUpdated}
          onNoteArchived={handleNoteArchived}
          onNotesReordered={handleNotesReordered}
        />
      </NotatnikPanel>

      <NotatnikCollapsible
        title="Czeka na zapłatę"
        description="Numer ZK — reszta wczyta się z Subiekta."
        count={paymentWatches.length}
        open={showZk}
        highlight={overdueZkCount > 0}
        badge={
          overdueZkCount > 0 ? (
            <Badge variant="danger" className="text-[10px]">
              {overdueZkCount} po terminie
            </Badge>
          ) : null
        }
        onToggle={() => setShowZk((v) => !v)}
      >
        <PaymentWatchSection
          watches={paymentWatches}
          readOnly={readOnly}
          embedded
          compact
          onWatchAdded={handleWatchAdded}
          onWatchSettled={handleWatchSettled}
          onWatchRefreshed={handleWatchRefreshed}
        />
      </NotatnikCollapsible>

      {hasArchive ? (
        <NotatnikCollapsible
          title="Archiwum"
          description="Opłacone ZK i zarchiwizowane notatki."
          count={archiveCount}
          open={showArchive}
          onToggle={() => setShowArchive((v) => !v)}
        >
          <div className="space-y-4">
            {archivedWatches.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">ZK opłacone</p>
                <ul className="space-y-2">
                  {archivedWatches.map((watch) => (
                    <li key={watch.id} id={`watch-${watch.id}`}>
                      <PaymentWatchCard
                        watch={watch}
                        readOnly={readOnly}
                        archived
                        compact
                        onRestored={handleWatchRestored}
                        onDeleted={() => handleWatchDeleted(watch.id)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {archivedNotes.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">Notatki</p>
                <ArchivedNotesSection
                  notes={archivedNotes}
                  readOnly={readOnly}
                  onRestored={handleNoteRestored}
                  onDeleted={handleNoteDeleted}
                />
              </div>
            ) : null}
          </div>
        </NotatnikCollapsible>
      ) : null}

      {undo && !readOnly ? (
        <UndoToast
          message={undoMessage}
          onDismiss={() => setUndo(null)}
          onUndo={() => void handleUndo()}
          undoShortcut="Ctrl+Z"
        />
      ) : null}
    </div>
  );
}
