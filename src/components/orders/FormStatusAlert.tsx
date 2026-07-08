"use client";

import { cn } from "@/lib/cn";
import { NoticeContent } from "@/components/ui/NoticeContent";
import type { NoticeTone } from "@/lib/ui/notice-content";
import { noticeToneShellClass } from "@/lib/ui/notice-content";

export type FormStatusTone = NoticeTone;

/** Jednolity komunikat w panelu statusu formularza (weryfikacja, prośba). */
export function FormStatusAlert({
  tone,
  title,
  children,
  className,
}: {
  tone: FormStatusTone;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const bodyText = typeof children === "string" ? children : null;

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2",
        noticeToneShellClass[tone],
        className,
      )}
    >
      {title ? (
        <NoticeContent
          title={title}
          description={bodyText ?? undefined}
          variant="inline"
        />
      ) : null}
      {title && !bodyText ? <div className="mt-1 text-xs leading-relaxed opacity-95">{children}</div> : null}
      {!title ? <div className="text-xs leading-relaxed opacity-95">{children}</div> : null}
    </div>
  );
}
