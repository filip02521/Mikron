"use client";

import type { ReactNode } from "react";
import { Toast } from "@/components/ui/Toast";
import { noticeToastProps, type NoticeToastPayload } from "@/lib/ui/notice-content";

/** Toast z automatycznym podziałem nagłówek / treść — spójny we wszystkich panelach. */
export function NoticeToast({
  notice,
  onDismiss,
  stacked,
  action,
  tone: toneOverride,
}: {
  notice: NoticeToastPayload | string;
  onDismiss: () => void;
  stacked?: boolean;
  action?: ReactNode;
  /** Gdy {@link notice} to sam string — domyślny ton. */
  tone?: "success" | "error" | "warning";
}) {
  const props = noticeToastProps(notice, toneOverride ?? "success");

  return (
    <Toast
      title={props.title}
      description={props.description}
      tone={props.tone}
      onDismiss={onDismiss}
      durationMs={props.durationMs}
      stacked={stacked}
      action={action}
    />
  );
}
