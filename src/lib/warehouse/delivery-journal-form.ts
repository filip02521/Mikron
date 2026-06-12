import type { WarehouseCarrier, WarehouseShipmentForm } from "@/lib/warehouse/delivery-carriers";

export type DeliveryJournalFormState = {
  supplierId: string;
  supplierOther: string;
  carrier: WarehouseCarrier;
  shipmentForm: WarehouseShipmentForm;
  packageCount: string;
  palletCount: string;
  note: string;
};

/** Po zapisie wyczyść dostawcę — wyraźny sygnał, że wpis poszedł; kurier i liczby zostają. */
export function formStateForNextEntry(
  previous: DeliveryJournalFormState
): DeliveryJournalFormState {
  return {
    supplierId: "",
    supplierOther: "",
    carrier: previous.carrier,
    shipmentForm: previous.shipmentForm,
    packageCount: previous.packageCount,
    palletCount: previous.palletCount,
    note: "",
  };
}
