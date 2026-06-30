import type { IndividualOrder, IndividualRequestKind } from "@/types/database";
import {
  informacjaFlowPathFromOrder,
  type InformacjaFlowPath,
} from "@/lib/orders/informacja-stock-out-reorder";
import type { TeethLineDetail, TeethManufacturer, TeethProductLine, TeethKind } from "@/lib/teeth/teeth-catalog";

export type { OrderFormSupplierOption as VerificationSupplierOption } from "@/lib/orders/order-form-suppliers";

export type VerificationFormState = {
  supplierId: string;
  salesPersonId: string;
  symbol: string;
  mikranCode: string;
  product: string;
  quantity: string;
  requestKind: IndividualRequestKind;
  subiektTwId: number | null;
  informacjaPath: InformacjaFlowPath | null;
  onHand?: number | null;
  reserved?: number | null;
  available?: number | null;
  stockSource?: "subiekt" | null;
  teethManufacturer?: TeethManufacturer | null;
  teethProductLine?: TeethProductLine | null;
  teethKind?: TeethKind | null;
  teethDetails?: TeethLineDetail[] | null;
};

/** Mapuje wiersz kolejki weryfikacji na stan formularza. */
export function orderToVerificationForm(order: IndividualOrder): VerificationFormState {
  return {
    supplierId: order.supplier_id ?? "",
    salesPersonId: order.sales_person_id,
    symbol: order.symbol !== "-" ? order.symbol : "",
    mikranCode: order.mikran_code?.trim() ?? "",
    product: order.products !== "Do uzupełnienia" ? order.products : "",
    quantity: order.quantity !== "-" ? order.quantity : "",
    requestKind: (order.request_kind ?? "zamowienie") as IndividualRequestKind,
    subiektTwId: order.subiekt_tw_id ?? null,
    informacjaPath:
      order.request_kind === "informacja"
        ? (informacjaFlowPathFromOrder(order) ?? "direct")
        : null,
    teethDetails: order.teeth_details?.map((d) => ({
      position: d.position,
      color: d.color,
      mould: d.mould,
      size: d.size,
      jaw: d.jaw,
      kind: d.kind,
    })) ?? null,
  };
}

export function emptyVerificationForm(): VerificationFormState {
  return {
    supplierId: "",
    salesPersonId: "",
    symbol: "",
    mikranCode: "",
    product: "",
    quantity: "",
    requestKind: "zamowienie",
    subiektTwId: null,
    informacjaPath: null,
  };
}

/** Czy po wczytaniu zamówienia warto dopasować dostawcę po tw_Id z katalogu. */
export function shouldLookupSupplierFromCatalog(order: IndividualOrder): boolean {
  const twId = order.subiekt_tw_id;
  return !order.supplier_id && twId != null && twId > 0;
}
