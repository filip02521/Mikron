import { formatSubmitResult } from "@/lib/orders/prosba-submit-result-copy";
import { plPozycja } from "@/lib/ui/polish-plurals";
import { formatZkWatchDisplayNumber } from "@/lib/sales/notepad-format";
import type { AutoProsbaResultCode, AutoProsbaBlockReason } from "@/lib/sales/zk-watch-auto-prosba";
import type { ZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import type { SalesZkWatch } from "@/types/database";

export type AutoProsbaToastPayload = {
  code: AutoProsbaResultCode;
  title: string;
  message: string;
  tone: "success" | "warning" | "error";
  actionHref?: string;
  actionLabel?: string;
  count?: number;
  complete?: number;
  verification?: number;
};

/** Biernik po „Dodano”: 1 pozycję, 2 pozycje, 5 pozycji. */
export function formatAddedPozycjeCount(count: number): string {
  const n = Math.abs(Math.trunc(count));
  if (n === 1) return "Dodano 1 pozycję";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `Dodano ${n} pozycje`;
  }
  return `Dodano ${n} pozycji`;
}

export function formatZkScopeSavedToast(orderCount: number): string {
  if (orderCount === 1) {
    return "Zapisano zakres — 1 pozycja do zamówienia.";
  }
  return `Zapisano zakres — ${orderCount} ${plPozycja(orderCount)} do zamówienia.`;
}

export function formatAutoProsbaSkippedLinesMessage(input: {
  effectiveCount: number;
  selectedCount: number;
}): string {
  const skipped = Math.max(0, input.selectedCount - input.effectiveCount);
  const kLabel =
    skipped === 1
      ? "1 pozycja jest już w prośbie lub czeka na informację o dostępności"
      : `${skipped} ${plPozycja(skipped)} ${skipped >= 2 && skipped <= 4 ? "są" : "jest"} już w prośbie lub czeka na informację o dostępności`;
  return `Dodano ${input.effectiveCount} z ${input.selectedCount} zaznaczonych pozycji — ${kLabel}.`;
}

const BLOCKED_COPY: Record<
  Exclude<
    AutoProsbaResultCode,
    | "created"
    | "created_partial_verification"
    | "created_supplement"
    | "created_with_skipped_lines"
  >,
  { title: string; message: string; tone: AutoProsbaToastPayload["tone"] }
> = {
  redirect_open_prosba: {
    title: "Pozycje już w prośbie",
    message: "Te pozycje są już w prośbie — otwórz ją w „Moje zamówienia”.",
    tone: "warning",
  },
  skipped_already_covered: {
    title: "Bez zmian w prośbie",
    message: "Te pozycje są już w prośbie — nic nie dodano.",
    tone: "warning",
  },
  blocked_teeth_incomplete: {
    title: "Brak listy zębów",
    message: "Najpierw uzupełnij listę zębów dla pozycji ZK.",
    tone: "error",
  },
  blocked_teeth_catalog: {
    title: "Katalog niedostępny",
    message:
      "Katalog zębów jest chwilowo niedostępny — odśwież stronę i spróbuj ponownie.",
    tone: "error",
  },
  blocked_no_lines: {
    title: "Brak pozycji",
    message: "Brak pozycji do dodania do prośby — odśwież ZK z Subiekta.",
    tone: "error",
  },
  blocked_no_scope: {
    title: "Brak zakresu",
    message: "Najpierw wybierz, które pozycje mają trafić do prośby.",
    tone: "error",
  },
  blocked_watch_closed: {
    title: "ZK zamknięte",
    message: "Nie można utworzyć prośby dla zamkniętego ZK.",
    tone: "error",
  },
  blocked_unauthorized: {
    title: "Brak uprawnień",
    message: "Brak uprawnień do utworzenia prośby dla tego ZK.",
    tone: "error",
  },
  blocked_batch_lock: {
    title: "Trwa inna operacja",
    message: "Trwa inna operacja dodawania zamówień — spróbuj za chwilę.",
    tone: "warning",
  },
  blocked_batch_size: {
    title: "Za dużo pozycji",
    message: "Można dodać maks. 30 pozycji naraz — utwórz prośbę z karty ZK.",
    tone: "error",
  },
  error_stock_ack_required: {
    title: "Wymagane potwierdzenie",
    message:
      "Potwierdź w dialogu, że chcesz utworzyć prośbę mimo stanu magazynowego.",
    tone: "error",
  },
  error_generic: {
    title: "Nie udało się utworzyć prośby",
    message: "Zakres pozostaje zapisany — spróbuj ponownie z karty ZK.",
    tone: "error",
  },
};

export function toastForAutoProsbaBlockedCode(
  code: keyof typeof BLOCKED_COPY,
  detail?: string
): AutoProsbaToastPayload {
  const base = BLOCKED_COPY[code];
  return {
    code,
    title: base.title,
    message:
      code === "error_generic" && detail?.trim()
        ? `${detail.trim()} Zakres pozostaje zapisany — spróbuj ponownie z karty ZK.`
        : code === "error_stock_ack_required" && detail?.trim()
          ? detail.trim()
          : base.message,
    tone: base.tone,
    ...(code === "redirect_open_prosba"
      ? { actionLabel: "Otwórz prośbę" }
      : code === "skipped_already_covered"
        ? { actionLabel: "Prośby tego klienta" }
        : {}),
  };
}

export function toastForScopeSavedOnly(orderCount: number): AutoProsbaToastPayload {
  return {
    code: "skipped_already_covered",
    title: "Zakres zapisany",
    message: formatZkScopeSavedToast(orderCount),
    tone: "success",
  };
}

export function toastForAutoProsbaDialogCancelled(): AutoProsbaToastPayload {
  return {
    code: "skipped_already_covered",
    title: "Zakres zapisany",
    message: "Prośba nie została utworzona. Możesz ją dodać ręcznie z karty ZK.",
    tone: "warning",
  };
}

export function toastForTeethSkippedAfterScope(): AutoProsbaToastPayload {
  return {
    code: "blocked_teeth_incomplete",
    title: "Zakres zapisany",
    message: "Uzupełnij listę zębów, potem utwórz prośbę z karty ZK.",
    tone: "warning",
  };
}

export function toastForScopeSavedProsbaFailed(reason: string): AutoProsbaToastPayload {
  const trimmed = reason
    .trim()
    .replace(/\s*Zakres pozostaje zapisany — spróbuj ponownie z karty ZK\.?\s*$/i, "")
    .trim();
  return {
    code: "error_generic",
    title: "Zakres zapisany",
    message: `Prośba nie została utworzona: ${trimmed || reason.trim()}. Możesz ją dodać ręcznie z karty ZK.`,
    tone: "error",
  };
}

export function buildAutoProsbaSuccessToast(input: {
  code: AutoProsbaResultCode;
  watch: SalesZkWatch;
  count: number;
  complete: number;
  verification: number;
  selectedScopeCount?: number;
  effectiveLineCount: number;
  includeCaseNote?: boolean;
  actionHref: string;
}): AutoProsbaToastPayload {
  const {
    code,
    watch,
    count,
    complete,
    verification,
    selectedScopeCount,
    effectiveLineCount,
    includeCaseNote,
    actionHref,
  } = input;

  const clientLabel = watch.client_label?.trim() || "klient";
  const zkSuffix = watch.zk_number
    ? ` Powiązano z ${formatZkWatchDisplayNumber(watch.zk_number)}.`
    : "";

  let message: string;
  switch (code) {
    case "created_supplement":
      message = `${formatAddedPozycjeCount(count)} do istniejącej prośby dla ${clientLabel}.${zkSuffix}`;
      break;
    case "created_partial_verification":
      message = `${formatSubmitResult({ count, complete, verification }, "zamowienie", true)}${zkSuffix}`;
      break;
    case "created_with_skipped_lines":
      message = `${formatAutoProsbaSkippedLinesMessage({
        effectiveCount: complete + verification,
        selectedCount: selectedScopeCount ?? effectiveLineCount,
      })}${zkSuffix}`;
      break;
    default:
      message = `${formatAddedPozycjeCount(count)} do prośby. Śledź status w „Moje zamówienia”.${zkSuffix}`;
      break;
  }

  if (includeCaseNote) {
    message += " Notatka sprawy trafiła do uwag pozycji.";
  }

  return {
    code,
    title: "Prośba zapisana",
    message: message.trim(),
    tone: "success",
    actionHref,
    actionLabel: "Prośby tego klienta",
    count,
    complete,
    verification,
  };
}

/** Czy toast sukcesu po auto-flow zostaje bez opakowania. */
export function shouldPassThroughAutoProsbaToastAfterScope(
  toast: Pick<AutoProsbaToastPayload, "tone" | "code">
): boolean {
  return toast.tone === "success";
}

function toastForScopeSavedWithAutoProsbaBlocked(
  toast: AutoProsbaToastPayload,
  selectedScopeCount?: number
): AutoProsbaToastPayload {
  const scopeLead =
    selectedScopeCount != null
      ? formatZkScopeSavedToast(selectedScopeCount).replace(/\.$/, "")
      : "Zakres zapisany";
  return {
    ...toast,
    title: "Zakres zapisany",
    message: `${scopeLead} — ${toast.message}`,
  };
}

/** Toast po zapisie zakresu — sukces bez zmian; blocked/redirect/skipped z kontekstem zakresu. */
export function normalizeAutoProsbaToastAfterScopeSaved(
  toast: AutoProsbaToastPayload,
  options?: { selectedScopeCount?: number }
): AutoProsbaToastPayload {
  if (shouldPassThroughAutoProsbaToastAfterScope(toast)) {
    return toast;
  }
  if (toast.code === "blocked_teeth_incomplete") {
    return toastForTeethSkippedAfterScope();
  }
  if (
    toast.code === "redirect_open_prosba" ||
    toast.code === "skipped_already_covered"
  ) {
    return toastForScopeSavedWithAutoProsbaBlocked(toast, options?.selectedScopeCount);
  }
  return toastForScopeSavedProsbaFailed(toast.message);
}

export function buildAutoProsbaClientBlockedToast(input: {
  watch: Pick<SalesZkWatch, "sales_person_id" | "client_label" | "client_kh_id" | "id" | "zk_number">;
  hints: Pick<ZkWatchOrderHints, "matchingOpenRequestIds">;
  blocked: AutoProsbaBlockReason;
  mojeHref: string;
  mojeHrefWithFocus: (ids: string[]) => string;
}): AutoProsbaToastPayload {
  const { hints, blocked, mojeHref, mojeHrefWithFocus } = input;

  if (blocked === "teeth_incomplete") {
    return toastForTeethSkippedAfterScope();
  }
  if (blocked === "no_effective_lines") {
    return toastForAutoProsbaBlockedCode("blocked_no_lines");
  }

  const code =
    blocked === "redirect_open_prosba"
      ? "redirect_open_prosba"
      : "skipped_already_covered";
  const toast = toastForAutoProsbaBlockedCode(code);
  if (code === "redirect_open_prosba") {
    return {
      ...toast,
      actionHref: mojeHrefWithFocus(hints.matchingOpenRequestIds),
    };
  }
  return {
    ...toast,
    actionHref: mojeHref,
  };
}

/** Następny stan ack po confirm dialogu stock / qty (jak OrderFormClient). */
export function nextAutoProsbaAckAfterConfirm(
  kind: "stock" | "zk_quantity",
  prevAck: {
    acknowledgeSufficientStock?: boolean;
    acknowledgeZkQuantityMismatch?: boolean;
  }
): {
  acknowledgeSufficientStock?: boolean;
  acknowledgeZkQuantityMismatch?: boolean;
} {
  if (kind === "stock") {
    return { ...prevAck, acknowledgeSufficientStock: true };
  }
  return { ...prevAck, acknowledgeZkQuantityMismatch: true };
}

/** Etykiety confirm dla auto-flow (zk_quantity — podmiana „wyślij”). */
export function mapZkQuantityConfirmLabelForAuto(confirmLabel: string): string {
  if (confirmLabel === "Potwierdzam i wysyłam") {
    return "Potwierdzam i tworzę prośbę";
  }
  if (confirmLabel === "Tak, wyślij prośbę") {
    return "Tak, utwórz prośbę";
  }
  let next = confirmLabel
    .replace(/wyślij prośbę/gi, "utwórz prośbę")
    .replace(/wyślij/gi, "utwórz prośbę")
    .replace(/wysył/gi, "twórz prośbę");
  if (next !== confirmLabel && next.length > 0) {
    next = next.charAt(0).toUpperCase() + next.slice(1);
  }
  return next;
}
