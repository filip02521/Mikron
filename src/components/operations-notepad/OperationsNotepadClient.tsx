"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { UndoToast } from "@/components/ui/UndoToast";
import { IconClipboardPen, IconArchive } from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { sectionIconTileBrandClass } from "@/lib/ui/ontime-theme";
import {
  collectOperationsTodayTasks,
  type OperationsNotepadData,
} from "@/lib/data/operations-notepad";
import {
  OPERATIONS_DEPARTMENT_LABELS,
  departmentsForRole,
} from "@/lib/operations/notepad-department";
import { isAdmin } from "@/lib/auth-roles";
import { sortOperationsNotes } from "@/lib/operations/operations-note-sort";
import { formatFollowUpLabel } from "@/lib/sales/notepad-follow-up";
import type { OperationsDepartment, OperationsNote, OperationsNoteVisibility, UserRole } from "@/types/database";
import {
  actionReorderOperationsNotes,
  actionRestoreOperationsNote,
} from "@/app/actions/operations-notepad";
import {
  OperationsNotesSection,
  NOTATNIK_KEYBOARD_HINTS,
} from "@/components/operations-notepad/OperationsNotesSection";
import { NOTATNIK_PAGE_CLASS, notatnikPanelClass } from "@/components/notatnik/notatnik-layout";
import { NOTE_COLOR_CARD } from "@/components/notatnik/note-styles";
import { cn } from "@/lib/cn";

type OperationsUndoState =
  | { type: "archive"; note: OperationsNote; visibility: OperationsNoteVisibility }
  | {
      type: "reorder";
      visibility: OperationsNoteVisibility;
      notes: OperationsNote[];
    };

function flashNoteAnchor(noteId: string) {
  window.setTimeout(() => {
    const el = document.getElementById(`note-${noteId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-indigo-400/70", "ring-offset-2", "rounded-md");
    window.setTimeout(() => {
      el.classList.remove("ring-2", "ring-indigo-400/70", "ring-offset-2", "rounded-md");
    }, 1200);
  }, 120);
}

export function OperationsNotepadClient({
  initial,
  department,
  userId,
  role,
}: {
  initial: OperationsNotepadData;
  department: OperationsDepartment;
  userId: string;
  role: UserRole;
}) {
  const router = useRouter();
  const allowedDepartments = departmentsForRole(role);

  const [privateNotes, setPrivateNotes] = useState(initial.privateNotes);
  const [publicNotes, setPublicNotes] = useState(initial.publicNotes);
  const [archivedNotes, setArchivedNotes] = useState(initial.archivedNotes);
  const [showArchive, setShowArchive] = useState(false);
  const [undo, setUndo] = useState<OperationsUndoState | null>(null);

  useEffect(() => {
    setPrivateNotes(initial.privateNotes);
    setPublicNotes(initial.publicNotes);
    setArchivedNotes(initial.archivedNotes);
    setShowArchive(false);
    setUndo(null);
  }, [department, initial]);

  const todayTasks = useMemo(
    () => collectOperationsTodayTasks(privateNotes, publicNotes, userId),
    [privateNotes, publicNotes, userId]
  );

  const undoMessage =
    undo?.type === "archive"
      ? `Zarchiwizowano: „${undo.note.title?.trim() || undo.note.body.trim().slice(0, 48) || "Notatka"}”. Masz 5 sekund na cofnięcie.`
      : undo?.type === "reorder"
        ? "Zmieniono kolejność notatek. Masz 5 sekund na cofnięcie."
        : "";

  useEffect(() => {
    if (!undo) return;
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
  }, [undo]);

  function refresh() {
    router.refresh();
  }

  async function handleUndo() {
    if (!undo) return;
    const snapshot = undo;
    setUndo(null);
    try {
      if (snapshot.type === "archive") {
        const { note: restored } = await actionRestoreOperationsNote(snapshot.note.id);
        setArchivedNotes((prev) => prev.filter((n) => n.id !== snapshot.note.id));
        if (restored.visibility === "private") {
          setPrivateNotes((prev) => sortOperationsNotes([restored, ...prev]));
        } else {
          setPublicNotes((prev) => sortOperationsNotes([restored, ...prev]));
        }
        flashNoteAnchor(restored.id);
      } else {
        const ids = sortOperationsNotes(snapshot.notes).map((n) => n.id);
        await actionReorderOperationsNotes(department, snapshot.visibility, ids);
        if (snapshot.visibility === "private") {
          setPrivateNotes(sortOperationsNotes(snapshot.notes));
        } else {
          setPublicNotes(sortOperationsNotes(snapshot.notes));
        }
      }
      refresh();
    } catch {
      setUndo(snapshot);
    }
  }

  function handleNotesReordered(
    visibility: OperationsNoteVisibility,
    next: OperationsNote[],
    previousForUndo?: OperationsNote[]
  ) {
    const sorted = sortOperationsNotes(next);
    if (visibility === "private") {
      setPrivateNotes(sorted);
    } else {
      setPublicNotes(sorted);
    }
    if (previousForUndo) {
      setUndo({ type: "reorder", visibility, notes: previousForUndo });
    }
  }

  function handleNoteArchived(note: OperationsNote, visibility: OperationsNoteVisibility) {
    const now = new Date().toISOString();
    if (visibility === "private") {
      setPrivateNotes((prev) => prev.filter((n) => n.id !== note.id));
    } else {
      setPublicNotes((prev) => prev.filter((n) => n.id !== note.id));
    }
    setArchivedNotes((prev) => [{ ...note, archived_at: now }, ...prev]);
    setUndo({ type: "archive", note, visibility });
    refresh();
  }

  function handlePrivateCreated(note: OperationsNote) {
    setPrivateNotes((prev) => sortOperationsNotes([note, ...prev]));
  }

  function handlePublicCreated(note: OperationsNote) {
    setPublicNotes((prev) => sortOperationsNotes([note, ...prev]));
  }

  function handlePrivateUpdated(note: OperationsNote) {
    setPrivateNotes((prev) => sortOperationsNotes(prev.map((n) => (n.id === note.id ? note : n))));
  }

  function handlePublicUpdated(note: OperationsNote) {
    setPublicNotes((prev) => sortOperationsNotes(prev.map((n) => (n.id === note.id ? note : n))));
  }

  function handlePrivateArchived(note: OperationsNote) {
    handleNoteArchived(note, "private");
  }

  function handlePublicArchived(note: OperationsNote) {
    handleNoteArchived(note, "public");
  }

  async function restoreArchived(note: OperationsNote) {
    const { note: restored } = await actionRestoreOperationsNote(note.id);
    setArchivedNotes((prev) => prev.filter((n) => n.id !== note.id));
    if (restored.visibility === "private") {
      setPrivateNotes((prev) => sortOperationsNotes([restored, ...prev]));
    } else {
      setPublicNotes((prev) => sortOperationsNotes([restored, ...prev]));
    }
  }

  const deptLabel = OPERATIONS_DEPARTMENT_LABELS[department];

  return (
    <div className={NOTATNIK_PAGE_CLASS}>
      <CardHeader
        title="Notatki"
        description={`Prywatne i wspólne dla działu: ${deptLabel}. Karteczki i przypomnienia.`}
      />

      <p className="mb-4 text-xs font-medium text-indigo-800">
        Aktywny dział: {deptLabel}
      </p>

      {allowedDepartments.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {allowedDepartments.map((d) => (
            <Link
              key={d}
              href={`/notatki?dzial=${d}`}
              className={cn(
                "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition",
                d === department
                  ? "bg-indigo-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              )}
            >
              {OPERATIONS_DEPARTMENT_LABELS[d]}
            </Link>
          ))}
        </div>
      ) : null}

      {todayTasks.length ? (
        <section className={cn(notatnikPanelClass(), "mb-4 border-violet-200/80 bg-violet-50/40 p-3")}>
          <h2 className="text-sm font-semibold text-slate-900">Do zrobienia dziś</h2>
          <ul className="mt-2 space-y-1.5">
            {todayTasks.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-white/80 bg-white/90 px-3 py-2 text-left text-xs shadow-sm hover:border-violet-200"
                  onClick={() =>
                    document.getElementById(`note-${note.id}`)?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    })
                  }
                >
                  <span className="truncate font-medium text-slate-900">
                    {note.title?.trim() || note.body.slice(0, 80)}
                  </span>
                  <Badge variant="purple" className="shrink-0 text-[10px]">
                    {formatFollowUpLabel(note.follow_up_at)}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="space-y-4">
        <Card className={notatnikPanelClass()}>
          <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
            <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
              <IconClipboardPen size={20} />
            </SectionHeadingIcon>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Prywatne</h2>
              <p className="text-xs text-slate-500">Widzisz tylko Ty</p>
            </div>
          </div>
          <OperationsNotesSection
            notes={privateNotes}
            department={department}
            visibility="private"
            currentUserId={userId}
            sectionTitle=""
            embedded
            onNoteCreated={handlePrivateCreated}
            onNoteUpdated={handlePrivateUpdated}
            onNoteArchived={handlePrivateArchived}
            onNotesReordered={(next, prev) => handleNotesReordered("private", next, prev)}
            allowReorder
          />
        </Card>

        <Card className={notatnikPanelClass()}>
          <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
            <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
              <IconClipboardPen size={20} />
            </SectionHeadingIcon>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Publiczne</h2>
              <p className="text-xs text-slate-500">
                Wspólna tablica działu {deptLabel} — widoczne tylko w tym dziale
              </p>
            </div>
          </div>
          <OperationsNotesSection
            notes={publicNotes}
            department={department}
            visibility="public"
            currentUserId={userId}
            embedded
            onNoteCreated={handlePublicCreated}
            onNoteUpdated={handlePublicUpdated}
            onNoteArchived={handlePublicArchived}
            onNotesReordered={(next, prev) => handleNotesReordered("public", next, prev)}
            allowReorder={isAdmin(role)}
          />
        </Card>

        {archivedNotes.length ? (
          <Card className={notatnikPanelClass()}>
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left"
              onClick={() => setShowArchive((v) => !v)}
            >
              <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
                <IconArchive size={20} />
              </SectionHeadingIcon>
              <span className="text-sm font-semibold text-slate-900">
                Archiwum ({archivedNotes.length})
              </span>
            </button>
            {showArchive ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {archivedNotes.map((note) => (
                  <article
                    key={note.id}
                    className={cn(
                      "rounded-md border p-3 opacity-80",
                      NOTE_COLOR_CARD[note.color] ?? NOTE_COLOR_CARD.default
                    )}
                  >
                    <p className="text-xs font-medium text-slate-900">
                      {note.title?.trim() || "Notatka"}
                    </p>
                    <p className="mt-1 line-clamp-3 text-xs text-slate-700">{note.body}</p>
                    {note.created_by === userId || isAdmin(role) ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2 h-7 px-2 text-xs"
                        onClick={() => void restoreArchived(note)}
                      >
                        Przywróć
                      </Button>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>

      {undo ? (
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

export { NOTATNIK_KEYBOARD_HINTS };
