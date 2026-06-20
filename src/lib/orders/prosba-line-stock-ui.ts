import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import { parseOrderQuantity } from "@/lib/orders/individual";
import {
  assessProsbaLineStockFromDraft,
  stockSnapshotFromLineDraft,
  type ProsbaLineStockAssessment,
} from "@/lib/orders/prosba-stock-check";
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

function formatAvailable(available: number): string {
  return `${available} szt.`;
}

/** Widok stanu magazynowego pozycji — tylko gdy mamy dane z Subiekta. */
export function buildProsbaLineStockStatusView(
  line: ProductLineDraft,
  requestKind: IndividualRequestKind
): ProsbaLineStockStatusView | null {
  if (requestKind !== "zamowienie") return null;
  const stock = stockSnapshotFromLineDraft(line);
  if (!stock) return null;

  const assessment = assessProsbaLineStockFromDraft(line, requestKind);
  const requestedQty = parseOrderQuantity(line.quantity);
  const availLabel = formatAvailable(stock.available);

  if (assessment === "sufficient" && requestedQty != null) {
    return {
      assessment,
      tone: "amber",
      shortLabel: `Stan ${availLabel}`,
      title: "Wystarczający stan magazynowy",
      detail: `Dostępne ${availLabel} przy zamówieniu ${requestedQty} szt. — sprawdź, czy prośba jest potrzebna.`,
    };
  }

  if (assessment === "insufficient" && requestedQty != null) {
    return {
      assessment,
      tone: "sky",
      shortLabel: `Dostępne ${availLabel}`,
      title: "Częściowy stan magazynowy",
      detail: `Dostępne ${availLabel}, zamawiasz ${requestedQty} szt. — reszta u dostawcy.`,
    };
  }

  if (assessment === "unavailable") {
    return {
      assessment,
      tone: "slate",
      shortLabel: "Brak na stanie",
      title: "Brak dostępnego stanu",
      detail:
        requestedQty != null
          ? `Dostępne 0 szt. przy zamówieniu ${requestedQty} szt.`
          : "Dostępne 0 szt. na magazynie.",
    };
  }

  return {
    assessment: "unknown",
    tone: "slate",
    shortLabel: `Stan ${availLabel}`,
    title: "Stan magazynowy",
    detail:
      stock.reserved > 0
        ? `Dostępne ${availLabel} (na stanie ${stock.onHand} szt., rezerwacja ${stock.reserved} szt.).`
        : `Dostępne ${availLabel} na magazynie.`,
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
  if (view) return `${view.title}. ${view.detail}`;
  const name = line.product.trim() || line.symbol.trim() || "Produkt";
  const qty = line.quantity.trim();
  const avail = line.available;
  const availLabel =
    avail != null && Number.isFinite(avail) ? `${avail} szt.` : "wystarczająco";
  return `Na stanie jest ${availLabel} — prośba może być zbędna przy zamówieniu ${qty} szt. (${name}).`;
}

/** Podsumowanie wielu pozycji z wystarczającym stanem — baner nad listą. */
export function buildProsbaSufficientStockSummary(count: number): {
  title: string;
  detail: string;
} | null {
  if (count <= 0) return null;
  if (count === 1) {
    return {
      title: "1 pozycja ma wystarczający stan",
      detail: "Rozwiń linię i sprawdź, czy zamówienie u dostawcy jest potrzebne.",
    };
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  const noun =
    mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "pozycje" : "pozycji";
  return {
    title: `${count} ${noun} mają wystarczający stan`,
    detail: "Sprawdź każdą linię — przy pełnym stanie prośba może być zbędna.",
  };
}
