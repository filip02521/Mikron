"use client";

import { useEffect, useState } from "react";
import { DeliveryJournalSearchField } from "@/components/queue/delivery-journal/DeliveryJournalSearchField";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export function ReceiveQueueSearchField({
  disabled,
  onDebouncedChange,
}: {
  disabled?: boolean;
  onDebouncedChange: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const debounced = useDebouncedValue(value, 150);

  useEffect(() => {
    if (!debounced) return;
    onDebouncedChange(debounced);
  }, [debounced, onDebouncedChange]);

  return (
    <DeliveryJournalSearchField
      id="receive-queue-product-search"
      label="Szukaj towaru"
      value={value}
      disabled={disabled}
      placeholder="Symbol, nazwa lub kod Mikron…"
      onChange={setValue}
      className="min-w-0"
    />
  );
}
