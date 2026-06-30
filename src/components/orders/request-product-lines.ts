import { randomId } from "@/lib/ensure-crypto";
import { MAX_BATCH_ORDER_LINES } from "@/lib/security/text-limits";
import type {
  TeethManufacturer,
  TeethProductLine,
  TeethKind,
  TeethLineDetail,
} from "@/lib/teeth/teeth-catalog";

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
  /** Skąd pochodzi wybór produktu (Subiekt API lub nasza baza). */
  source?: "subiekt" | "catalog" | null;
  /** Ilość z pozycji ZK (prefill) — walidacja prośby vs ZK. */
  zkQuantity?: number | null;
  /** Uwagi handlowca — zapis per pozycja w `sales_request_note`. */
  requestNote?: string;
  /** Producent zębów (auto-detekcja z prosba_teeth_products). */
  teethManufacturer?: TeethManufacturer | null;
  /** Linia produktowa — ustalana przy wyborze towaru (admin lub nazwa). Nie zmienia się w modalu listy. */
  teethProductLine?: TeethProductLine | null;
  /** Typ zęba — przednie/tylne (auto-detekcja z prosba_teeth_products). */
  teethKind?: TeethKind | null;
  /** Szczegóły zębowe per sztuka (kolor, wzór, rozmiar). */
  teethDetails?: TeethLineDetail[];
};

export function newProductLine(): ProductLineDraft {
  return {
    id: randomId(),
    symbol: "",
    mikranCode: "",
    product: "",
    quantity: "",
    source: null,
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
