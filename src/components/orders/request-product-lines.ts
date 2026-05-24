import { MAX_BATCH_ORDER_LINES } from "@/lib/security/text-limits";

export type ProductLineDraft = {
  id: string;
  symbol: string;
  product: string;
  quantity: string;
  clientName?: string;
};

export function newProductLine(): ProductLineDraft {
  return {
    id: crypto.randomUUID(),
    symbol: "",
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
