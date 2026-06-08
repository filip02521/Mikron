import type { Metadata } from "next";
import { BrandMomentCard, BrandMomentHomeActions } from "@/components/brand/BrandMomentLayout";
import { pageMetadata } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadata(
  "Nie znaleziono strony",
  "Adres mógł się zmienić albo strona została usunięta."
);

export default function NotFound() {
  return (
    <BrandMomentCard
      title="Nie znaleziono strony"
      description="Adres mógł się zmienić albo strona została usunięta."
      className="py-6 sm:py-10"
    >
      <BrandMomentHomeActions />
    </BrandMomentCard>
  );
}
