"use client";

import { useEffect, useMemo, useState } from "react";
import type { IndividualRequestKind } from "@/types/database";
import { actionUpdateIndividualRequest } from "@/app/actions/admin";
import { actionUpdateMyIndividualRequest } from "@/app/actions/my-orders";
import { RequestProductLinesEditor } from "@/components/orders/RequestProductLinesEditor";
import { newProductLine, type ProductLineDraft } from "@/components/orders/request-product-lines";
import { RequestCompletenessBanner } from "@/components/orders/RequestCompletenessBanner";
import { RequestKindPicker } from "@/components/ui/RequestKindPicker";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { SupplierPickerField } from "@/components/orders/SupplierPickerField";
import { useActionPending } from "@/hooks/useActionPending";

export type EditIndividualRequestInitial = {
  supplierId: string;
  salesPersonId: string;
  requestKind: IndividualRequestKind;
  lines: ProductLineDraft[];
};

export function EditIndividualRequestModal({
  open,
  onClose,
  mode,
  orderIds,
  initial,
  suppliers,
  salesPeople = [],
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  mode: "procurement" | "sales";
  orderIds: string[];
  initial: EditIndividualRequestInitial | null;
  suppliers: { id: string; name: string }[];
  salesPeople?: { id: string; name: string }[];
  onSaved?: (message: string) => void;
}) {
  const { pending, pendingMessage, run } = useActionPending();
  const [supplierId, setSupplierId] = useState("");
  const [salesPersonId, setSalesPersonId] = useState("");
  const [requestKind, setRequestKind] = useState<IndividualRequestKind>("zamowienie");
  const [lines, setLines] = useState<ProductLineDraft[]>([newProductLine()]);

  const sortedSuppliers = useMemo(
    () => [...suppliers].sort((a, b) => a.name.localeCompare(b.name, "pl")),
    [suppliers]
  );

  useEffect(() => {
    if (!open || !initial) return;
    setSupplierId(initial.supplierId);
    setSalesPersonId(initial.salesPersonId);
    setRequestKind(initial.requestKind);
    setLines(
      initial.lines.length > 0
        ? initial.lines.map((l) => ({ ...l }))
        : [newProductLine()]
    );
  }, [open, initial]);

  const save = () => {
    if (!initial) return;
    run(
      async () => {
        const payload = {
          supplierId,
          salesPersonId,
          requestKind,
          lines: lines.map((l) => ({
            id: l.id,
            symbol: l.symbol,
            product: l.product,
            quantity: l.quantity,
            clientName: l.clientName,
            subiektTwId: l.subiektTwId,
          })),
        };
        if (mode === "procurement") {
          await actionUpdateIndividualRequest(orderIds, payload);
        } else {
          await actionUpdateMyIndividualRequest(orderIds, payload);
        }
        onSaved?.("Zapisano zmiany w prośbie.");
        onClose();
      },
      "Zapisywanie prośby…"
    );
  };

  if (!open) return null;

  return (
    <ModalShell
      open
      onClose={onClose}
      title={mode === "procurement" ? "Popraw prośbę handlowca" : "Popraw swoją prośbę"}
      size="lg"
      tier="raised"
      loadingMessage={pendingMessage}
      disableBackdropClose={pending}
      bodyClassName="px-5 py-4 sm:px-6"
      footer={
        <>
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            Anuluj
          </Button>
          <Button disabled={pending || !initial} onClick={save}>
            Zapisz zmiany
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-slate-600">
        {mode === "procurement"
          ? "Korekta przed złożeniem zamówienia u dostawcy — np. zły dostawca lub opis produktu."
          : "Możesz poprawić prośbę, dopóki dział dostaw nie oznaczy jej jako zamówionej."}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dostawca" className="sm:col-span-2">
          <SupplierPickerField
            suppliers={sortedSuppliers}
            value={supplierId}
            onChange={setSupplierId}
            disabled={pending}
            allowEmpty
            emptyLabel="— wybierz —"
          />
        </Field>

        {mode === "procurement" && salesPeople.length > 0 ? (
          <Field label="Handlowiec" className="sm:col-span-2">
            <Select
              disabled={pending}
              value={salesPersonId}
              onChange={(e) => setSalesPersonId(e.target.value)}
            >
              {salesPeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <div className="sm:col-span-2">
          <RequestKindPicker value={requestKind} onChange={setRequestKind} />
        </div>

        <div className="sm:col-span-2">
          <RequestCompletenessBanner
            draft={{
              supplierId,
              symbol: lines.find((l) => l.symbol.trim())?.symbol,
              product: lines.find((l) => l.product.trim())?.product,
              quantity: lines.find((l) => l.quantity.trim())?.quantity,
              requestKind,
            }}
            requestKind={requestKind}
          />
        </div>

        <div className="sm:col-span-2">
          <RequestProductLinesEditor
            lines={lines}
            onChange={setLines}
            requestKind={requestKind}
            showClientField={mode === "sales"}
          />
        </div>
      </div>
    </ModalShell>
  );
}
