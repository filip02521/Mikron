import { AppBrandContentFooter } from "@/components/layout/AppBrandContentFooter";
import { PageHeader } from "@/components/ui/PageHeader";

/** Strona ustawień: nagłówek na tle, sekcje jako karty-rodzeństwo (DESIGN.md → Anatomia ekranu). */
export function SettingsWorkspace({
  title,
  description,
  hint,
  hintAriaLabel = "O tej stronie",
  children,
}: {
  title: string;
  description: string;
  hint?: string;
  hintAriaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} description={description} hint={hint} hintAriaLabel={hintAriaLabel} />
      <div className="space-y-6">{children}</div>
      <AppBrandContentFooter mobileOnly variant="page" />
    </>
  );
}
