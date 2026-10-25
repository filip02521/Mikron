import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import { parseOrderQuantity } from "@/lib/orders/individual";
import {
  assessProsbaLineStockFromDraft,
  stockSnapshotFromLineDraft,
  type ProsbaLineStockAssessment,
} from "@/lib/orders/prosba-stock-check";
import { isStockExemptTwId } from "@/lib/orders/teeth-stock-exempt";
import type { IndividualRequestKind } from "@/types/database";

export type ProsbaLineStockTone = "amber" | "sky" | "slate";

export type ProsbaLineStockStatusView = {
  assessment: ProsbaLineStockAssessment;
  title: string;
  detail: string;
  tone: ProsbaLineStockTone;
  shortLabel: string;
};

const TONE_BADGE: Record<ProsbaLineStockTone, string> = {
  amber: "bg-amber-100 text-amber-950 ring-1 ring-amber-200/80",
  sky: "bg-sky-100 text-sky-900 ring-1 ring-sky-200/70",
  slate: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80",
};

const TONE_ROW: Record<ProsbaLineStockTone, string> = {
  amber: "bg-amber-50/55",
  sky: "bg-sky-50/40",
  slate: "bg-slate-50/60",
};

const TONE_SHELL: Record<ProsbaLineStockTone, string> = {
  amber: "border-amber-200/90 bg-amber-50/70",
  sky: "border-sky-200/90 bg-sky-50/65",
  slate: "border-slate-200/90 bg-slate-50/80",
};

const TONE_TITLE: Record<ProsbaLineStockTone, string> = {
  amber: "text-amber-950",
  sky: "text-sky-950",
  slate: "text-slate-800",
};

const TONE_DETAIL: Record<ProsbaLineStockTone, string> = {
  amber: "text-amber-900/90",
  sky: "text-sky-900/90",
  slate: "text-slate-600",
};

const TONE_ICON: Record<ProsbaLineStockTone, string> = {
  amber: "text-amber-700",
  sky: "text-sky-700",
  slate: "text-slate-600",
};

export function prosbaLineStockBadgeClass(tone: ProsbaLineStockTone): string {
  return TONE_BADGE[tone];
}

export function prosbaLineStockRowTintClass(tone: ProsbaLineStockTone): string {
  return TONE_ROW[tone];
}

export function prosbaLineStockShellClass(tone: ProsbaLineStockTone): string {
  return TONE_SHELL[tone];
}

export function prosbaLineStockTitleClass(tone: ProsbaLineStockTone): string {
  return TONE_TITLE[tone];
}

export function prosbaLineStockDetailClass(tone: ProsbaLineStockTone): string {
  return TONE_DETAIL[tone];
}

export function prosbaLineStockIconClass(tone: ProsbaLineStockTone): string {
  return TONE_ICON[tone];
}

/**
 * Towar w parze (opakowanie zbiorcze ↔ pojedyncze sztuki): stan liczy obie wersje. Handlowiec ma wiedzieć,
 * co wliczyliśmy — bez słów „para”, „cover”, „demontaż”.
 */
export function prosbaPairStockShort(role: "pack" | "piece" | null | undefined): string {
  if (role === "piece") return "razem z opakowaniami zbiorczymi";
  if (role === "pack") return "razem z pojedynczymi sztukami";
  return "razem z drugą wersją towaru";
}

export function prosbaPairStockNote(role: "pack" | "piece" | null | undefined, unitsPerPack: number | null | undefined): string {
  const n = unitsPerPack != null && unitsPerPack > 1 ? Math.trunc(unitsPerPack) : null;
  if (role === "piece") {
    return n
      ? `Liczymy też opakowania zbiorcze (1 op. = ${n} szt.) - magazyn je rozpakuje.`
      : "Liczymy też opakowania zbiorcze - magazyn je rozpakuje.";
  }
  if (role === "pack") {
    return n
      ? `Liczymy też pojedyncze sztuki: ${n} szt. zastępuje 1 op.`
      : "Liczymy też pojedyncze sztuki tego towaru.";
  }
  return n ? `Liczymy razem sztuki i opakowania zbiorcze (1 op. = ${n} szt.).` : "Liczymy razem sztuki i opakowania zbiorcze.";
}

function formatAvailable(available: number): string {
  return `${available} szt.`;
}

/** Widok stanu magazynowego pozycji — tylko gdy mamy dane z Subiekta. */
export function buildProsbaLineStockStatusView(
  line: ProductLineDraft,
  requestKind: IndividualRequestKind,
  stockExemptTwIds?: ReadonlySet<number>
): ProsbaLineStockStatusView | null {
  if (requestKind !== "zamowienie") return null;
  if (isStockExemptTwId(line.subiektTwId, stockExemptTwIds)) return null;
  const stock = stockSnapshotFromLineDraft(line);
  if (!stock) return null;

  const assessment = assessProsbaLineStockFromDraft(line, requestKind, stockExemptTwIds);
  const requestedQty = parseOrderQuantity(line.quantity);
  const availLabel = formatAvailable(stock.available);
  const reserveShort = stock.reserved > 0 ? ` (−${stock.reserved} rez.)` : "";

  if (assessment === "sufficient" && requestedQty != null) {
    return {
      assessment,
      tone: "amber",
      shortLabel: `Na stanie ${availLabel}${reserveShort}`,
      title: "Wystarczy z półki",
      detail: line.pairStockCover
        ? prosbaPairStockNote(line.pairRole, line.pairUnitsPerPack)
        : `${availLabel}${reserveShort}`,
    };
  }

  if (assessment === "insufficient" && requestedQty != null) {
    return {
      assessment,
      tone: "sky",
      shortLabel: `Dostępne ${availLabel}${reserveShort}`,
      title: "Za mało z półki",
      detail: `${availLabel}${reserveShort}`,
    };
  }

  if (assessment === "unavailable") {
    return {
      assessment,
      tone: "slate",
      shortLabel: "Brak na stanie",
      title: "Brak na stanie",
      detail: "",
    };
  }

  return {
    assessment: "unknown",
    tone: "slate",
    shortLabel: `Stan ${availLabel}${reserveShort}`,
    title: "Stan magazynowy",
    detail: "",
  };
}

export function formatProsbaStockLineHint(
  line: Pick<ProductLineDraft, "product" | "symbol" | "quantity" | "available">
): string {
  const view = buildProsbaLineStockStatusView(
    {
      id: "",
      symbol: line.symbol ?? "",
      mikranCode: "",
      product: line.product ?? "",
      quantity: line.quantity ?? "",
      stockSource: line.available != null ? "subiekt" : null,
      onHand: line.available ?? undefined,
      reserved: 0,
      available: line.available ?? undefined,
    },
    "zamowienie"
  );
  const qty = line.quantity.trim();
  if (view) {
    const core = view.detail.trim()
      ? `${view.title}. ${view.detail}`
      : `${view.title} · ${view.shortLabel}`;
    return qty ? `${core} · prośba ${qty} szt.` : core;
  }
  const name = line.product.trim() || line.symbol.trim() || "Produkt";
  const avail = line.available;
  const availLabel =
    avail != null && Number.isFinite(avail) ? `${avail} szt.` : "wystarczająco";
  return `Na stanie jest ${availLabel} - prośba może być zbędna przy zamówieniu ${qty} szt. (${name}).`;
}

/** Podsumowanie wielu pozycji z wystarczającym stanem — baner nad listą. */
export function buildProsbaSufficientStockSummary(count: number): {
  title: string;
  detail: string;
} | null {
  if (count <= 0) return null;
  if (count === 1) {
    return {
      title: "1 pozycja: stan wystarczy",
      detail: "Szczegóły w rozwiniętej linii.",
    };
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  const noun =
    mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "pozycje" : "pozycji";
  return {
    title: `${count} ${noun}: stan wystarczy`,
    detail: "Szczegóły w rozwiniętych liniach.",
  };
}
