import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import {
  hasAnyProductHint,
  hasValidOrderQuantity,
} from "@/lib/orders/request-completeness";
import type { IndividualRequestKind } from "@/types/database";
import { resolveTeethCatalogFromDraft } from "@/lib/teeth/teeth-catalog";
import { isStockExemptTwId } from "@/lib/orders/teeth-stock-exempt";
import { teethLineDetailsComplete } from "@/lib/teeth/teeth-validation";

export type ProsbaFieldKey = "symbol" | "mikranCode" | "product" | "quantity";

export type ProsbaFieldVisualState = "default" | "warning" | "error" | "success";

export type ProsbaLineFieldState = {
  state: ProsbaFieldVisualState;
  message?: string;
};

export type ProsbaLineFieldMap = Record<ProsbaFieldKey, ProsbaLineFieldState>;

const DEFAULT_FIELD: ProsbaLineFieldState = { state: "default" };

function emptyFieldMap(): ProsbaLineFieldMap {
  return {
    symbol: { ...DEFAULT_FIELD },
    mikranCode: { ...DEFAULT_FIELD },
    product: { ...DEFAULT_FIELD },
    quantity: { ...DEFAULT_FIELD },
  };
}

function hasPartialLineInput(line: ProductLineDraft): boolean {
  return (
    line.symbol.trim() !== "" ||
    line.mikranCode.trim() !== "" ||
    line.product.trim() !== "" ||
    line.quantity.trim() !== ""
  );
}

/** Czy pokazać walidację pól dla danej pozycji. */
export function shouldShowProsbaLineFieldValidation(
  line: ProductLineDraft,
  options: {
    active: boolean;
    validationAttempted: boolean;
    /** Walidacja na żywo — po wpisaniu produktu lub rozpoczęciu edycji. */
    liveValidation?: boolean;
    lineCount: number;
    requestKind: IndividualRequestKind;
  }
): boolean {
  if (options.validationAttempted) {
    return hasAnyProductHint(line) || options.active || options.lineCount === 1;
  }
  if (options.liveValidation) {
    if (hasAnyProductHint(line)) return true;
    if (options.active && hasPartialLineInput(line)) return true;
    return false;
  }
  if (options.active) {
    return hasPartialLineInput(line);
  }
  return false;
}

/** Czy linia ma braki wymagane do wysłania (do podświetlenia zwiniętej pozycji). */
export function prosbaLineHasSubmitBlockers(
  line: ProductLineDraft,
  requestKind: IndividualRequestKind
): boolean {
  const fields = assessProsbaLineFields(line, requestKind, "strict");
  if (prosbaLineHasFieldIssues(fields)) return true;
  if (prosbaLineHasTeethBlockers(line, requestKind)) return true;
  return false;
}

/** Czy linia zębowa ma brakujące szczegóły (kolor/wzór/rozmiar). */
export function prosbaLineHasTeethBlockers(
  line: ProductLineDraft,
  requestKind: IndividualRequestKind,
  options?: { exemptTwIds?: ReadonlySet<number> }
): boolean {
  if (requestKind !== "zamowienie") return false;

  const catalog = resolveTeethCatalogFromDraft({
    teethProductLine: line.teethProductLine,
    teethManufacturer: line.teethManufacturer,
    product: line.product,
    subiektTwId: line.subiektTwId,
    adminProductLine: line.teethProductLine,
  });
  const isTeethProduct = isStockExemptTwId(line.subiektTwId, options?.exemptTwIds);

  if (!catalog && !isTeethProduct) return false;

  return !teethLineDetailsComplete({
    teethDetails: line.teethDetails,
    quantity: line.quantity,
    product: line.product,
    subiektTwId: line.subiektTwId,
    adminProductLine: line.teethProductLine,
    adminManufacturer: line.teethManufacturer,
    isTeethProduct: true,
  });
}

/** Stan wizualny pól pozycji prośby (braki, ilość). */
export function assessProsbaLineFields(
  line: ProductLineDraft,
  requestKind: IndividualRequestKind,
  mode: "soft" | "strict"
): ProsbaLineFieldMap {
  const fields = emptyFieldMap();
  const draft = {
    symbol: line.symbol,
    mikranCode: line.mikranCode,
    product: line.product,
    quantity: line.quantity,
    requestKind,
  };
  const linked = line.subiektTwId != null && line.subiektTwId > 0;
  const severity: ProsbaFieldVisualState = mode === "strict" ? "error" : "warning";

  if (!hasAnyProductHint(draft)) {
    const message = "Wpisz nazwę lub symbol produktu (kod Mikran obok).";
    for (const key of ["symbol", "product"] as const) {
      fields[key] = { state: severity, message };
    }
    return fields;
  }

  if (linked) {
    if (line.symbol.trim()) fields.symbol = { state: "success" };
    if (line.mikranCode.trim()) fields.mikranCode = { state: "success" };
    if (line.product.trim()) fields.product = { state: "success" };
  }

  if (
    requestKind === "zamowienie" &&
    !hasValidOrderQuantity(line.quantity, requestKind)
  ) {
    fields.quantity = {
      state: severity,
      message: "Podaj ilość (liczba sztuk, np. 1).",
    };
  } else if (requestKind === "zamowienie" && line.quantity.trim()) {
    fields.quantity = { state: "success" };
  }

  return fields;
}

export function prosbaLineHasFieldIssues(fields: ProsbaLineFieldMap): boolean {
  return Object.values(fields).some(
    (field) => field.state === "error" || field.state === "warning"
  );
}
