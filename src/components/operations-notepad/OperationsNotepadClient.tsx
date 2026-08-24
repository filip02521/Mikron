"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { UndoToast } from "@/components/ui/UndoToast";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { NOTEPAD_UNDO_TOAST, type ToastNotice, toastFromUnknown } from "@/lib/ui/notice-copy";
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
} from "@/lib/data/operations-notepad-shared";
import { flashNotepadAnchor } from "@/lib/sales/notepad-anchor";
import {
  OPERATIONS_DEPARTMENT_LABELS,
  departmentsForRole,
} from "@/lib/operations/notepad-department";
import {
  isUndoExpired,
  undoExpiresAtNow,
  undoWindowBannerDescription,
} from "@/lib/orders/daily-panel-undo";
import { isAdmin } from "@/lib/auth-roles";
import { canMutateOperationsNote } from "@/lib/operations/operations-note-access";
import { sortOperationsNotes } from "@/lib/operations/operations-note-sort";
import type { OperationsDepartment, OperationsNote, OperationsNoteVisibility, UserRole, Workspace } from "@/types/database";
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
import { SalesKeyboardShortcutsStrip } from "@/components/sales/SalesKeyboardShortcutsStrip";
import { SALES_PAGE_HEADER_HINTS } from "@/lib/sales/sales-page-ui-copy";
import { cn } from "@/lib/cn";
import { isEditableKeyboardTarget } from "@/lib/platform/editable-keyboard-target";
import { useUndoShortcutLabel } from "@/lib/platform/keyboard-shortcut-label";
import { useAdminPanelPreview } from "@/components/layout/AdminPanelPreviewContext";

type OperationsUndoState = (
  | { type: "archive"; note: OperationsNote; visibility: OperationsNoteVisibility }
  | {
      type: "reorder";
      visibility: OperationsNoteVisibility;
      notes: OperationsNote[];
    }
) & { expiresAt: number; performedAt: number };

function createUndoTiming() {
  const performedAt = Date.now();
  return { performedAt, expiresAt: undoExpiresAtNow(performedAt) };
}

function flashNoteAnchor(noteId: string) {
  flashNotepadAnchor(`note-${noteId}`, { durationMs: 1200 });
}

export function OperationsNotepadClient({
  initial,
  department,
  userId,
  role,
  assignedWorkspaces = [],
  loadError = null,
  deptBadges = {},
}: {
  initial: OperationsNotepadData;
  department: OperationsDepartment;
  userId: string;
  role: UserRole;
  assignedWorkspaces?: Workspace[];
  loadError?: string | null;
  deptBadges?: Record<string, number>;
}) {
  const router = useRouter();
  const undoShortcut = useUndoShortcutLabel();
  const { readOnly: panelReadOnly } = useAdminPanelPreview();
  const allowedDepartments = departmentsForRole(role, assignedWorkspaces);

  const [privateNotes, setPrivateNotes] = useState(initial.privateNotes);
  const [publicNotes, setPublicNotes] = useState(initial.publicNotes);
  const [archivedNotes, setArchivedNotes] = useState(initial.archivedNotes);
  const [showArchive, setShowArchive] = useState(false);
  const [shortcutBoard, setShortcutBoard] = useState<"private" | "public">("private");
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);
  const [undo, setUndo] = useState<OperationsUndoState | null>(null);
  const [undoFeedback, setUndoFeedback] = useState<ToastNotice | null>(null);
  const dismissUndo = useCallback(() => {
    setUndo(null);
    router.refresh();
  }, [router]);

  const dataSyncKey = `${department}\0${initial.privateNotes.map((n) => n.updated_at).join("\0")}\0${initial.publicNotes.map((n) => n.updated_at).join("\0")}\0${initial.archivedNotes.map((n) => n.updated_at).join("\0")}`;
  const [appliedDataSyncKey, setAppliedDataSyncKey] = useState(dataSyncKey);
  if (dataSyncKey !== appliedDataSyncKey) {
    setAppliedDataSyncKey(dataSyncKey);
    setPrivateNotes(initial.privateNotes);
    setPublicNotes(initial.publicNotes);
    setArchivedNotes(initial.archivedNotes);
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

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleFocusNoteHandled = useCallback((noteId: string) => {
    setFocusNoteId((current) => (current === noteId ? null : current));
  }, []);

  const handleTodayTaskClick = useCallback((noteId: string) => {
    setFocusNoteId(noteId);
    if (publicNotes.some((n) => n.id === noteId)) {
      setShortcutBoard("public");
    } else if (privateNotes.some((n) => n.id === noteId)) {
      setShortcutBoard("private");
    }
  }, [privateNotes, publicNotes, setShortcutBoard]);

  const handleUndo = useCallback(async () => {
    if (!undo) return;
    const snapshot = undo;
    if (isUndoExpired(snapshot.expiresAt)) {
      setUndo(null);
      setUndoFeedback(NOTEPAD_UNDO_TOAST.expired);
      return;
    }
    setUndo(null);
    setUndoFeedback(null);
    try {
      if (snapshot.type === "archive") {
        const { note: restored } = await actionRestoreOperationsNote(snapshot.note.id, {
          enforceUndoWindow: true,
        });
        setArchivedNotes((prev) => prev.filter((n) => n.id !== snapshot.note.id));
        if (restored.visibility === "private") {
          setPrivateNotes((prev) => sortOperationsNotes([restored, ...prev]));
        } else {
          setPublicNotes((prev) => sortOperationsNotes([restored, ...prev]));
        }
        flashNoteAnchor(restored.id);
      } else {
        const ids = sortOperationsNotes(snapshot.notes).map((n) => n.id);
        await actionReorderOperationsNotes(department, snapshot.visibility, ids, {
          undoPerformedAt: snapshot.performedAt,
        });
        if (snapshot.visibility === "private") {
          setPrivateNotes(sortOperationsNotes(snapshot.notes));
        } else {
          setPublicNotes(sortOperationsNotes(snapshot.notes));
        }
      }
      setUndoFeedback(NOTEPAD_UNDO_TOAST.success);
      refresh();
    } catch (e) {
      if (!isUndoExpired(snapshot.expiresAt)) setUndo(snapshot);
      setUndoFeedback(
        toastFromUnknown(e, NOTEPAD_UNDO_TOAST.failed.text)
      );
    }
  }, [undo, department, refresh]);

  useEffect(() => {
    if (!undo || panelReadOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (isEditableKeyboardTarget(e.target)) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        void handleUndo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, panelReadOnly, handleUndo]);

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
      setUndo({
        type: "reorder",
        visibility,
        notes: previousForUndo,
        ...createUndoTiming(),
      });
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
    setUndo({ type: "archive", note, visibility, ...createUndoTiming() });
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
  const notesReadOnly = panelReadOnly;
  const privateHasNotes = privateNotes.length > 0;
  const publicHasNotes = publicNotes.length > 0;
  const searchShortcutBoard: "private" | "public" =
    shortcutBoard === "private"
      ? privateHasNotes || !publicHasNotes
        ? "private"
        : "public"
      : publicHasNotes || !privateHasNotes
        ? "public"
        : "private";

  return (
    <div className={OPERATIONS_NOTEPAD_PAGE_CLASS}>
      {undoFeedback ? (
        <NoticeToast
          notice={undoFeedback}
          stacked={Boolean(undo)}
          tone={undoFeedback.tone}
          onDismiss={() => setUndoFeedback(null)}
        />
      ) : null}
      {undo ? (
        <UndoToast
          title={undoTitle}
          description={undoDescription}
          placement="floating"
          expiresAt={undo.expiresAt}
          onDismiss={dismissUndo}
          onUndo={() => void handleUndo()}
          undoShortcut={undoShortcut}
        />
      ) : null}
      <Card padding={false} className="overflow-visible">
        <CardHeader
          inset
          density="compact"
          title="Notatki"
          hint={SALES_PAGE_HEADER_HINTS.operationsNotepad}
          hintAriaLabel="O notatkach operacyjnych"
          leading={
            <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
              <IconNotepad size={20} />
            </SectionHeadingIcon>
          }
        />

        <SalesKeyboardShortcutsStrip items={NOTATNIK_KEYBOARD_HINTS} embedded />

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
            {allowedDepartments.map((d) => {
              const deptCount = deptBadges[d] ?? 0;
              return (
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
                  {deptCount > 0 ? (
                    <span
                      className={cn(
                        "ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
                        d === department
                          ? "bg-indigo-600 text-white"
                          : "bg-indigo-100 text-indigo-700",
                      )}
                    >
                      {deptCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
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
          onTaskClick={handleTodayTaskClick}
          embedded
        />

        <div className="space-y-3 p-3 sm:p-4">
          <NotatnikPanel
            domain="panel"
            title="Prywatne"
            description="Widzisz tylko Ty — karteczki nie są widoczne dla zespołu."
            count={privateNotes.length || undefined}
            icon={<IconClipboardPen size={17} />}
            className="overflow-visible"
            bodyClassName="overflow-visible"
          >
            <OperationsNotesSection
              notes={privateNotes}
              department={department}
              visibility="private"
              currentUserId={userId}
              readOnly={notesReadOnly}
              embedded
              focusNoteId={focusNoteId}
              onFocusNoteHandled={handleFocusNoteHandled}
              onNoteCreated={handlePrivateCreated}
              onNoteUpdated={handlePrivateUpdated}
              onNoteArchived={handlePrivateArchived}
              onNotesReordered={(next, prev) => handleNotesReordered("private", next, prev)}
              allowReorder
              enableWindowShortcuts={!notesReadOnly && shortcutBoard === "private"}
              enableSearchShortcut={!notesReadOnly && searchShortcutBoard === "private"}
              onBoardActivate={() => setShortcutBoard("private")}
              isUserAdmin={isAdmin(role)}
            />
          </NotatnikPanel>

          <NotatnikPanel
            domain="panel"
            title="Wspólne"
            description={`Tablica działu ${deptLabel} — zespół może edytować, archiwizować i przestawiać te notatki.`}
            count={publicNotes.length || undefined}
            icon={<IconUsers size={17} />}
            tileClassName="bg-sky-100 text-sky-800"
            className="overflow-visible"
            bodyClassName="overflow-visible"
          >
            <OperationsNotesSection
              notes={publicNotes}
              department={department}
              visibility="public"
              currentUserId={userId}
              readOnly={notesReadOnly}
              embedded
              focusNoteId={focusNoteId}
              onFocusNoteHandled={handleFocusNoteHandled}
              onNoteCreated={handlePublicCreated}
              onNoteUpdated={handlePublicUpdated}
              onNoteArchived={handlePublicArchived}
              onNotesReordered={(next, prev) => handleNotesReordered("public", next, prev)}
              allowReorder
              enableWindowShortcuts={!notesReadOnly && shortcutBoard === "public"}
              enableSearchShortcut={!notesReadOnly && searchShortcutBoard === "public"}
              onBoardActivate={() => setShortcutBoard("public")}
              isUserAdmin={isAdmin(role)}
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
                canRestore={(note) =>
                  !notesReadOnly &&
                  canMutateOperationsNote({
                    visibility: note.visibility,
                    createdBy: note.created_by,
                    userId,
                    isAdmin: isAdmin(role),
                  })
                }
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
