import { BrandMomentCard, BrandMomentHomeActions } from "@/components/brand/BrandMomentLayout";

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
