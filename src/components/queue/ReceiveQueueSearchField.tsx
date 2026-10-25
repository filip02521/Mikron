"use client";

import { useEffect, useRef, useState } from "react";
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

  const reported = useRef(debounced);
  // Także pusta wartość: po wyczyszczeniu pola (×, Escape) lista wraca do pełnej.
  // Tylko zmiana — ponowne zamontowanie (panel filtrów) nie kasuje aktywnego szukania.
  useEffect(() => {
    if (debounced === reported.current) return;
    reported.current = debounced;
    onDebouncedChange(debounced);
  }, [debounced, onDebouncedChange]);

  return (
    <DeliveryJournalSearchField
      id="receive-queue-product-search"
      label="Szukaj towaru"
      hideLabel
      value={value}
      disabled={disabled}
      placeholder="Symbol, nazwa lub kod Mikron…"
      onChange={setValue}
      className="min-w-0 sm:max-w-xs"
    />
  );
}
