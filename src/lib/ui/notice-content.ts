/** Wspólne typy i copy dla Toast, Alert, FormStatusAlert i banerów formularza. */

export type NoticeTone = "info" | "success" | "warning" | "error";

export type NoticeCopy = {
  title: string;
  description?: string;
};

/** Komunikat inline w formularzu (panel statusu, gotowość prośby). */
export type FormMessage = {
  tone: NoticeTone;
  /** Krótki nagłówek — opcjonalnie; gdy brak, {@link text} zostanie podzielony automatycznie. */
  title?: string;
  /** Treść (ciało komunikatu) lub pełny tekst, gdy brak {@link title}. */
  text: string;
};

/** Komunikat chwilowy (Toast) — rozszerza {@link FormMessage} o akcję. */
export type TransientNotice = FormMessage & {
  tone: Exclude<NoticeTone, "info">;
  actionHref?: string;
  actionLabel?: string;
  durationMs?: number;
};

/** Stan toastu w komponentach — {@link text} lub {@link message} (legacy). */
export type NoticeToastPayload = {
  text?: string;
  /** @deprecated alias {@link text} */
  message?: string;
  title?: string;
  description?: string;
  tone?: Exclude<NoticeTone, "info">;
  durationMs?: number;
};

export function noticeToastProps(
  notice: NoticeToastPayload | string,
  fallbackTone: Exclude<NoticeTone, "info"> = "success",
) {
  const payload = typeof notice === "string" ? { text: notice } : notice;
  const copy = resolveNoticeCopy({
    title: payload.title,
    description: payload.description,
    text: payload.text,
    message: payload.message,
  });
  return {
    title: copy.title,
    description: copy.description,
    tone: payload.tone ?? fallbackTone,
    durationMs: payload.durationMs,
  };
}

export const noticeToneShellClass: Record<NoticeTone, string> = {
  info: "border-indigo-200 bg-indigo-50 text-indigo-950",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  error: "border-red-200 bg-red-50 text-red-950",
};

/** Dzieli długi komunikat na nagłówek i treść (polski: kropka, myślnik). */
export function splitNoticeText(text: string): NoticeCopy {
  const trimmed = text.trim();
  if (!trimmed) return { title: "" };

  const emDash = trimmed.indexOf(" — ");
  if (emDash >= 8 && emDash <= 72) {
    const title = trimmed.slice(0, emDash).trim();
    const description = trimmed.slice(emDash + 3).trim();
    if (title && description) return { title, description };
  }

  const sentenceBreak = trimmed.match(/^(.+?[.!?])\s+(\S[\s\S]{7,})$/);
  if (sentenceBreak && sentenceBreak[1].length <= 80) {
    return {
      title: sentenceBreak[1].trim(),
      description: sentenceBreak[2].trim(),
    };
  }

  return { title: trimmed };
}

export function resolveNoticeCopy(input: {
  title?: string;
  text?: string;
  description?: string;
  message?: string;
}): NoticeCopy {
  if (input.title?.trim()) {
    const body = (input.description ?? input.text)?.trim();
    return {
      title: input.title.trim(),
      description: body || undefined,
    };
  }

  const raw = (input.text ?? input.message ?? input.description ?? "").trim();
  return splitNoticeText(raw);
}

export function resolveFormMessage(message: FormMessage): NoticeCopy {
  return resolveNoticeCopy({
    title: message.title,
    text: message.text,
  });
}
