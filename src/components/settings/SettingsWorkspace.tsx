import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { AppBrandContentFooter } from "@/components/layout/AppBrandContentFooter";
import { Card, CardHeader } from "@/components/ui/Card";
import { IconSettings } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { salesCardBodyClass } from "@/lib/ui/ontime-theme";

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
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        density="compact"
        leading={
          <SectionHeadingIcon tileClassName="bg-slate-100 text-slate-700">
            <IconSettings size={20} />
          </SectionHeadingIcon>
        }
        title={title}
        description={description}
        hint={hint}
        hintAriaLabel={hintAriaLabel}
      />
      <div className={cn(salesCardBodyClass, "space-y-4")}>
        {children}
      </div>
      <AppBrandContentFooter mobileOnly variant="page" />
    </Card>
  );
}
