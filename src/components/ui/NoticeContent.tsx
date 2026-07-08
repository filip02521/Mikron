import { cn } from "@/lib/cn";
import {
  noticeBodyClass,
  noticeBodyInlineClass,
  noticeTitleClass,
  noticeTitleInlineClass,
} from "@/lib/ui/ontime-theme";

/** Nagłówek + treść — spójna typografia Toast / UndoToast / SystemNotice. */
export function NoticeContent({
  title,
  description,
  variant = "floating",
  className,
}: {
  title: string;
  description?: string;
  /** floating = Toast; inline = Alert / FormStatusAlert */
  variant?: "floating" | "inline";
  className?: string;
}) {
  const titleClass = variant === "floating" ? noticeTitleClass : noticeTitleInlineClass;
  const bodyClass = variant === "floating" ? noticeBodyClass : noticeBodyInlineClass;

  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <p className={titleClass}>{title}</p>
      {description ? <p className={bodyClass}>{description}</p> : null}
    </div>
  );
}
