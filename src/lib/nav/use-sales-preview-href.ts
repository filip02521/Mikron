"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { hrefWithSalesPreviewFromUrl } from "@/lib/nav/sales-preview-href";

/** Linki w panelu handlowca z zachowaniem ?dla= z bieżącego URL. */
export function useSalesPreviewHref() {
  const previewDla = useSearchParams().get("dla");
  return useCallback(
    (href: string) => hrefWithSalesPreviewFromUrl(href, previewDla),
    [previewDla]
  );
}
