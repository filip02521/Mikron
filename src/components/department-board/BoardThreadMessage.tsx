"use client";

import {
  IconClipboardPen,
  IconMessageSquare,
  IconWarehouse,
} from "@/components/icons/StrokeIcons";
import { formatBoardDate } from "@/lib/department-board/format";
import {
  boardThreadAuthorNameClass,
  boardThreadAvatarClass,
  boardThreadMessageShellClass,
  boardThreadRoleBadgeClass,
} from "@/lib/department-board/department-board-thread-styles";
import { cn } from "@/lib/cn";

export type BoardThreadMessageTone = "question" | "procurement" | "sales";

function threadRoleLabel(tone: BoardThreadMessageTone, replyKind?: string): string {
  if (tone === "question") return "Pytanie handlowca";
  if (tone === "procurement") return replyKind ?? "Odpowiedź zakupów";
  return replyKind ?? "Wiadomość";
}

function ThreadAvatar({ tone }: { tone: BoardThreadMessageTone }) {
  const className = "size-4";
  if (tone === "question") return <IconClipboardPen size={16} className={className} />;
  if (tone === "procurement") return <IconWarehouse size={16} className={className} />;
  return <IconMessageSquare size={16} className={className} />;
}

export function BoardThreadMessage({
  tone,
  authorLabel,
  body,
  createdAt,
  replyKind,
  className,
}: {
  tone: BoardThreadMessageTone;
  authorLabel: string;
  body: string;
  createdAt: string;
  replyKind?: string;
  className?: string;
}) {
  const roleLabel = threadRoleLabel(tone, replyKind);

  return (
    <div className={cn(boardThreadMessageShellClass(tone), className)}>
      <div className="flex items-start gap-3">
        <div className={boardThreadAvatarClass(tone)} aria-hidden>
          <ThreadAvatar tone={tone} />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={boardThreadRoleBadgeClass(tone)}>{roleLabel}</span>
            <span className={boardThreadAuthorNameClass(tone)}>{authorLabel}</span>
            <span className="text-[11px] text-slate-400">{formatBoardDate(createdAt)}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{body}</p>
        </div>
      </div>
    </div>
  );
}
