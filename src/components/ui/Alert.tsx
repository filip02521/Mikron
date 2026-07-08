import { cn } from "@/lib/cn";
import { NoticeContent } from "@/components/ui/NoticeContent";
import type { NoticeTone } from "@/lib/ui/notice-content";
import { noticeToneShellClass, splitNoticeText } from "@/lib/ui/notice-content";

export function Alert({
  children,
  title,
  tone = "info",
  className,
}: {
  children: React.ReactNode;
  /** Krótki nagłówek — treść w {@link children}. */
  title?: string;
  tone?: NoticeTone;
  className?: string;
}) {
  const bodyText = typeof children === "string" ? children : null;
  const copy = title
    ? { title, description: bodyText ?? undefined }
    : bodyText
      ? splitNoticeText(bodyText)
      : { title: "", description: undefined };

  return (
    <div
      role="alert"
      className={cn(
        "rounded-md border px-4 py-3 leading-relaxed break-words",
        noticeToneShellClass[tone],
        className,
      )}
    >
      {copy.title ? (
        copy.description && typeof children === "string" ? (
          <NoticeContent title={copy.title} description={copy.description} variant="inline" />
        ) : title ? (
          <>
            <NoticeContent title={copy.title} variant="inline" />
            {typeof children !== "string" ? (
              <div className="mt-1 text-sm leading-relaxed opacity-95">{children}</div>
            ) : null}
          </>
        ) : (
          <NoticeContent title={copy.title} description={copy.description} variant="inline" />
        )
      ) : (
        <div className="text-sm leading-relaxed">{children}</div>
      )}
    </div>
  );
}
