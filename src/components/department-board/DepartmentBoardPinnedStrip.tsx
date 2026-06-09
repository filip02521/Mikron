import { IconPin } from "@/components/icons/StrokeIcons";
import { SystemNotice } from "@/components/ui/SystemNotice";
import type { DepartmentBoardThreadRow } from "@/lib/data/department-board";
import { salesBoardAnnouncementHref } from "@/lib/data/department-board";
import { MICROCOPY } from "@/lib/ui/microcopy";

export function DepartmentBoardPinnedStrip({
  pinned,
  className,
}: {
  pinned: Pick<DepartmentBoardThreadRow, "id" | "title" | "body">[];
  className?: string;
}) {
  if (!pinned.length) return null;

  const primary = pinned[0]!;
  const extra = pinned.length - 1;
  const title = primary.title.trim() || "Ogłoszenie";

  return (
    <SystemNotice
      variant="pinned"
      className={className}
      icon={<IconPin size={15} strokeWidth={2.25} />}
      title={
        <span className="block truncate font-normal text-slate-700">
          <span className="text-slate-500">Przypięte:</span>{" "}
          <span className="font-medium text-slate-900">{title}</span>
          {extra > 0 ? (
            <span className="font-normal text-slate-500">{` (+${extra})`}</span>
          ) : null}
        </span>
      }
      href={salesBoardAnnouncementHref(primary.id)}
      actionLabel={MICROCOPY.actions.readMore}
    />
  );
}
