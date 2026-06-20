import { randomId } from "@/lib/ensure-crypto";
import { MAX_BATCH_ORDER_LINES } from "@/lib/security/text-limits";

export type ProductLineDraft = {
  /** Id UI (React). Dla zapisu edycji liczy się tylko id z orderIds — nowe linie dostają losowe id. */
  id: string;
  symbol: string;
  /** Kod Mikran (tw_PLU). */
  mikranCode: string;
  product: string;
  quantity: string;
  clientName?: string;
  /** kh_Id odbiorcy z Subiekta (opcjonalnie). */
  clientKhId?: number | null;
  subiektTwId?: number | null;
  onHand?: number | null;
  reserved?: number | null;
  available?: number | null;
  /** Stan magazynowy z Subiekta (tylko UI / walidacja). */
  stockSource?: "subiekt" | null;
  /** Uwagi handlowca — zapis per pozycja w `sales_request_note`. */
  requestNote?: string;
};

export function newProductLine(): ProductLineDraft {
  return {
    id: randomId(),
    symbol: "",
    mikranCode: "",
    product: "",
    quantity: "",
  };
}

export function updateProductLine(
  lines: ProductLineDraft[],
  index: number,
  patch: Partial<Omit<ProductLineDraft, "id">>
): ProductLineDraft[] {
  return lines.map((line, i) => (i === index ? { ...line, ...patch } : line));
}

export function removeProductLineAt(
  lines: ProductLineDraft[],
  index: number,
  minLines = 1
): ProductLineDraft[] {
  if (lines.length <= minLines) return lines;
  return lines.filter((_, i) => i !== index);
}

export function appendProductLine(lines: ProductLineDraft[]): ProductLineDraft[] {
  if (lines.length >= MAX_BATCH_ORDER_LINES) return lines;
  return [...lines, newProductLine()];
}
