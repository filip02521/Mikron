"use client";

import { BoardQuestionAttachmentsGallery } from "@/components/department-board/BoardQuestionAttachmentsGallery";
import { BoardFileAttachments } from "@/components/department-board/BoardFileAttachments";
import { isBoardImageAttachment } from "@/lib/department-board/attachments";
import { formatBoardDate } from "@/lib/department-board/format";
import {
  boardThreadAuthorNameClass,
  boardThreadAvatarClass,
  boardThreadMessageShellClass,
  boardThreadRoleBadgeClass,
} from "@/lib/department-board/department-board-thread-styles";
import type { DepartmentBoardThreadAttachment } from "@/types/database";
import { cn } from "@/lib/cn";
import { initialsFromLabel } from "@/lib/ui/initials";

export type BoardThreadMessageTone = "question" | "procurement" | "sales";

function threadRoleLabel(tone: BoardThreadMessageTone, replyKind?: string): string {
  if (tone === "question") return "Pytanie handlowca";
  if (tone === "procurement") return replyKind ?? "Odpowiedź zakupów";
  return replyKind ?? "Wiadomość";
}

export function BoardThreadMessage({
  tone,
  authorLabel,
  body,
  createdAt,
  replyKind,
  attachments,
  className,
}: {
  tone: BoardThreadMessageTone;
  authorLabel: string;
  body: string;
  createdAt: string;
  replyKind?: string;
  attachments?: DepartmentBoardThreadAttachment[];
  className?: string;
}) {
  const roleLabel = threadRoleLabel(tone, replyKind);
  // Zdjęcia w galerii, pliki (np. oferta dostawcy w PDF) jako odnośniki.
  const images = (attachments ?? []).filter((a) => isBoardImageAttachment(a.mime_type));
  const files = (attachments ?? []).filter((a) => !isBoardImageAttachment(a.mime_type));

  return (
    <div className={cn(boardThreadMessageShellClass(tone), className)}>
      <div className="flex items-start gap-3">
        {/* Inicjały autora — widać, kto pyta i kto odpowiada; rola jest w odznace obok. */}
        <div className={cn(boardThreadAvatarClass(tone), "text-xs font-semibold")} title={authorLabel} aria-hidden>
          {initialsFromLabel(authorLabel)}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={boardThreadRoleBadgeClass(tone)}>{roleLabel}</span>
            <span className={boardThreadAuthorNameClass(tone)}>{authorLabel}</span>
            <span className="text-[11px] text-slate-400">{formatBoardDate(createdAt)}</span>
          </div>
          {body.trim() ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{body}</p>
          ) : null}
          {images.length ? <BoardQuestionAttachmentsGallery attachments={images} /> : null}
          {files.length ? <BoardFileAttachments attachments={files} /> : null}
        </div>
      </div>
    </div>
  );
}
