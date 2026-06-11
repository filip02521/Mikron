"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { UndoToast } from "@/components/ui/UndoToast";
import { IconNotepad, IconArchive, IconClipboardPen, IconUsers } from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import {
  panelChromeInsetClass,
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
  sectionIconTileBrandClass,
} from "@/lib/ui/ontime-theme";
import {
  collectOperationsTodayTasks,
  type OperationsNotepadData,
} from "@/lib/data/operations-notepad";
import {
  OPERATIONS_DEPARTMENT_LABELS,
  departmentsForRole,
} from "@/lib/operations/notepad-department";
import { undoWindowBannerDescription } from "@/lib/orders/daily-panel-undo";
import { isAdmin } from "@/lib/auth-roles";
import { sortOperationsNotes } from "@/lib/operations/operations-note-sort";
import type { OperationsDepartment, OperationsNote, OperationsNoteVisibility, UserRole } from "@/types/database";
import {
  actionReorderOperationsNotes,
  actionRestoreOperationsNote,
} from "@/app/actions/operations-notepad";
import {
  OperationsNotesSection,
  NOTATNIK_KEYBOARD_HINTS,
} from "@/components/operations-notepad/OperationsNotesSection";
import { OperationsTodayTasksSection } from "@/components/operations-notepad/OperationsTodayTasksSection";
import { OperationsArchivedNotesSection } from "@/components/operations-notepad/OperationsArchivedNotesSection";
import { OPERATIONS_NOTEPAD_PAGE_CLASS } from "@/components/operations-notepad/operations-notepad-layout";
import { NotatnikPanel } from "@/components/notatnik/NotatnikPanel";
import { NotatnikCollapsible } from "@/components/notatnik/NotatnikCollapsible";
import { KeyboardShortcutsHint } from "@/components/ui/KeyboardShortcutsHint";
import { cn } from "@/lib/cn";

const OPERATIONS_NOTEPAD_INTRO =
  "Prywatne karteczki i wspólna tablica działu. Przypomnienia nie trafiają do panelu dziennego.";

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
  loadError = null,
}: {
  initial: OperationsNotepadData;
  department: OperationsDepartment;
  userId: string;
  role: UserRole;
  loadError?: string | null;
}) {
  const router = useRouter();
  const allowedDepartments = departmentsForRole(role);

  const [privateNotes, setPrivateNotes] = useState(initial.privateNotes);
  const [publicNotes, setPublicNotes] = useState(initial.publicNotes);
  const [archivedNotes, setArchivedNotes] = useState(initial.archivedNotes);
  const [showArchive, setShowArchive] = useState(false);
  const [undo, setUndo] = useState<OperationsUndoState | null>(null);
  const dismissUndo = useCallback(() => setUndo(null), []);

  const dataSyncKey = `${department}\0${initial.privateNotes.map((n) => n.updated_at).join("\0")}\0${initial.publicNotes.map((n) => n.updated_at).join("\0")}\0${initial.archivedNotes.map((n) => n.updated_at).join("\0")}`;
  const [appliedDataSyncKey, setAppliedDataSyncKey] = useState(dataSyncKey);
  if (dataSyncKey !== appliedDataSyncKey) {
    setAppliedDataSyncKey(dataSyncKey);
    setPrivateNotes(initial.privateNotes);
    setPublicNotes(initial.publicNotes);
    setArchivedNotes(initial.archivedNotes);
    setShowArchive(false);
    setUndo(null);
  }

  const todayTasks = useMemo(
    () => collectOperationsTodayTasks(privateNotes, publicNotes, userId),
    [privateNotes, publicNotes, userId]
  );

  const undoTitle =
    undo?.type === "archive"
      ? `Zarchiwizowano: „${undo.note.title?.trim() || undo.note.body.trim().slice(0, 48) || "Notatka"}”`
      : undo?.type === "reorder"
        ? "Zmieniono kolejność notatek"
        : "";
  const undoDescription = undo ? undoWindowBannerDescription() : "";

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

  function handleArchivedRestored(restored: OperationsNote) {
    setArchivedNotes((prev) => prev.filter((n) => n.id !== restored.id));
    if (restored.visibility === "private") {
      setPrivateNotes((prev) => sortOperationsNotes([restored, ...prev]));
    } else {
      setPublicNotes((prev) => sortOperationsNotes([restored, ...prev]));
    }
    flashNoteAnchor(restored.id);
    refresh();
  }

  const deptLabel = OPERATIONS_DEPARTMENT_LABELS[department];

  return (
    <div className={OPERATIONS_NOTEPAD_PAGE_CLASS}>
      {undo ? (
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
          title="Notatki"
          description={OPERATIONS_NOTEPAD_INTRO}
          leading={
            <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
              <IconNotepad size={20} />
            </SectionHeadingIcon>
          }
          action={
            <KeyboardShortcutsHint items={[...NOTATNIK_KEYBOARD_HINTS]} compact />
          }
        />

        {allowedDepartments.length > 1 ? (
          <div
            className={cn(
              panelChromeInsetClass,
              "flex flex-wrap items-center gap-2 border-b border-slate-100 py-2.5 sm:py-3"
            )}
            role="group"
            aria-label="Dział"
          >
            <span className="text-xs font-medium text-slate-500">Dział</span>
            {allowedDepartments.map((d) => (
              <Link
                key={d}
                href={`/notatki?dzial=${d}`}
                aria-current={d === department ? "page" : undefined}
                className={cn(
                  panelChoiceChipClass,
                  "min-h-9 py-2 sm:min-h-0",
                  d === department ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass
                )}
              >
                {OPERATIONS_DEPARTMENT_LABELS[d]}
              </Link>
            ))}
          </div>
        ) : (
          <div className={cn(panelChromeInsetClass, "border-b border-slate-100 py-2 text-xs text-slate-600")}>
            Dział: <span className="font-medium text-slate-900">{deptLabel}</span>
          </div>
        )}

        {loadError ? (
          <Alert tone="error" className="mx-3 mt-3 sm:mx-4">
            {loadError}
          </Alert>
        ) : null}

        <OperationsTodayTasksSection
          notes={todayTasks}
          onTaskClick={flashNoteAnchor}
          embedded
        />

        <div className="space-y-3 p-3 sm:p-4">
          <NotatnikPanel
            domain="panel"
            title="Prywatne"
            description="Widzisz tylko Ty — karteczki nie są widoczne dla zespołu."
            count={privateNotes.length || undefined}
            icon={<IconClipboardPen size={17} />}
          >
            <OperationsNotesSection
              notes={privateNotes}
              department={department}
              visibility="private"
              currentUserId={userId}
              embedded
              onNoteCreated={handlePrivateCreated}
              onNoteUpdated={handlePrivateUpdated}
              onNoteArchived={handlePrivateArchived}
              onNotesReordered={(next, prev) => handleNotesReordered("private", next, prev)}
              allowReorder
            />
          </NotatnikPanel>

          <NotatnikPanel
            domain="panel"
            title="Wspólne"
            description={`Tablica działu ${deptLabel} — widoczne dla całego zespołu w tym dziale.`}
            count={publicNotes.length || undefined}
            icon={<IconUsers size={17} />}
            tileClassName="bg-sky-100 text-sky-800"
          >
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
          </NotatnikPanel>

          {archivedNotes.length > 0 ? (
            <NotatnikCollapsible
              domain="panel"
              title="Archiwum"
              description="Zarchiwizowane notatki — możesz je przywrócić."
              count={archivedNotes.length}
              open={showArchive}
              onToggle={() => setShowArchive((v) => !v)}
              icon={<IconArchive size={17} />}
              tileClassName="bg-slate-100 text-slate-600"
            >
              <OperationsArchivedNotesSection
                notes={archivedNotes}
                canRestore={(note) => note.created_by === userId || isAdmin(role)}
                onRestored={handleArchivedRestored}
              />
            </NotatnikCollapsible>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

export { NOTATNIK_KEYBOARD_HINTS };
