"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { uniqueById } from "@/lib/sales/notepad-list";
import { sortPaymentWatches } from "@/lib/sales/payment-watch-sort";
import type { SalesNotepadData } from "@/lib/data/sales-notepad";
import type { SubiektAvailability } from "@/lib/subiekt/availability";
import type { SalesNote, SalesPaymentWatch } from "@/types/database";
import { SubiektStatusBar } from "@/components/subiekt/SubiektStatusBar";
import { PaymentWatchSection } from "./PaymentWatchSection";
import { PaymentWatchCard } from "./PaymentWatchCard";
import { NotesSection } from "./NotesSection";
import { ArchivedNotesSection } from "./ArchivedNotesSection";

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
  const [showArchive, setShowArchive] = useState(false);

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

  function refresh() {
    router.refresh();
  }

  function handleWatchAdded(watch: SalesPaymentWatch) {
    setPaymentWatches((prev) => uniqueById(sortPaymentWatches([watch, ...prev])));
    setArchivedWatches((prev) => prev.filter((w) => w.id !== watch.id));
    refresh();
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
  }

  function handleNoteUpdated(note: SalesNote) {
    setNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)));
    refresh();
  }

  function handleNoteArchived(noteId: string) {
    const now = new Date().toISOString();
    setNotes((prev) => {
      const note = prev.find((n) => n.id === noteId);
      if (note) {
        setArchivedNotes((archived) =>
          uniqueById([{ ...note, archived_at: now, updated_at: now }, ...archived])
        );
      }
      return prev.filter((n) => n.id !== noteId);
    });
    setShowArchive(true);
    refresh();
  }

  function handleNoteRestored(note: SalesNote) {
    setArchivedNotes((prev) => prev.filter((n) => n.id !== note.id));
    setNotes((prev) => uniqueById([note, ...prev]));
    refresh();
  }

  const subiektForNotepad = subiektAvailability
    ? {
        ...subiektAvailability,
        message: contextualizeSubiektMessage(subiektAvailability.message),
      }
    : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-8">
      <PageHeader title={pageTitle} description={pageDescription} />

      {subiektForNotepad ? (
        <SubiektStatusBar initial={subiektForNotepad} className="mb-2" />
      ) : null}

      <PaymentWatchSection
        watches={paymentWatches}
        readOnly={readOnly}
        onWatchAdded={handleWatchAdded}
        onWatchSettled={handleWatchSettled}
        onWatchRefreshed={handleWatchRefreshed}
      />

      <NotesSection
        notes={notes}
        readOnly={readOnly}
        onNoteCreated={handleNoteCreated}
        onNoteUpdated={handleNoteUpdated}
        onNoteArchived={handleNoteArchived}
      />

      {(archivedWatches.length > 0 || archivedNotes.length > 0) && (
        <section className="space-y-4 border-t border-slate-200 pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Archiwum</h2>
              <p className="mt-1 text-sm text-slate-500">
                Opłacone ZK i zarchiwizowane notatki.
              </p>
            </div>
            <button
              type="button"
              className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
              onClick={() => setShowArchive((v) => !v)}
            >
              {showArchive ? "Ukryj" : "Pokaż"}
            </button>
          </div>

          {showArchive ? (
            <div className="space-y-6">
              {archivedWatches.length > 0 ? (
                <ul className="space-y-3">
                  {archivedWatches.map((watch) => (
                    <li key={watch.id}>
                      <PaymentWatchCard
                        watch={watch}
                        readOnly={readOnly}
                        archived
                        onRestored={handleWatchRestored}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
              <ArchivedNotesSection
                notes={archivedNotes}
                readOnly={readOnly}
                onRestored={handleNoteRestored}
              />
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
