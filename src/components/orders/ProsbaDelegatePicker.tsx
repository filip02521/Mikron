"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { prosbaHref } from "@/lib/orders/prosba-url";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Select } from "@/components/ui/Field";

export function ProsbaDelegatePicker({
  people,
  selectedId,
  selfId,
}: {
  people: { id: string; name: string }[];
  selectedId: string;
  selfId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supplierId = searchParams.get("dostawca") ?? undefined;

  return (
    <Card className="mb-6">
      <CardHeader
        title="W imieniu kogo składasz prośbę?"
        description="Prośba pojawi się na panelu wybranego handlowca."
      />
      <Field label="Handlowiec">
        <Select
          value={selectedId}
          onChange={(e) => {
            const id = e.target.value;
            router.push(
              prosbaHref({
                salesPersonId: id === selfId ? undefined : id,
                supplierId,
              })
            );
          }}
        >
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id === selfId ? `${p.name} (ja)` : p.name}
            </option>
          ))}
        </Select>
      </Field>
    </Card>
  );
}
