import { getSessionUser } from "@/lib/auth";
import { isAdmin, isSalesAccount } from "@/lib/auth-roles";
import { fetchStaffByRole, fetchStaffVacationPeriods } from "@/lib/data/staff-vacation-periods";
import { StaffVacationCalendar } from "@/components/staff/StaffVacationCalendar";
import { Card, CardHeader } from "@/components/ui/Card";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { NavIcon } from "@/components/icons/NavIcon";
import { AppBrandContentFooter } from "@/components/layout/AppBrandContentFooter";
import { salesCardBodyClass, sectionIconTileBrandClass } from "@/lib/ui/ontime-theme";
import { todayDateKeyInWarsaw } from "@/lib/time/warsaw";
import { ROLE_LABELS } from "@/lib/users/labels";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadata("Urlopy działu", "Kalendarz urlopów Twojego działu");

export default async function StaffUrlopyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isSalesAccount(user.role)) redirect("/zespol/urlopy");

  const adminMode = isAdmin(user.role);
  const role = adminMode ? "zakupy" : user.role;

  let staff: Awaited<ReturnType<typeof fetchStaffByRole>> = [];
  let periodsByUser: Record<string, Awaited<ReturnType<typeof fetchStaffVacationPeriods>>[string]> = {};
  let loadError: string | null = null;

  try {
    staff = await fetchStaffByRole(role);
    const ids = staff.map((s) => s.id);
    periodsByUser = await fetchStaffVacationPeriods(ids);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Nie udało się wczytać urlopów.";
  }

  const departmentLabel = ROLE_LABELS[role] ?? "Twój dział";

  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        density="compact"
        leading={
          <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
            <NavIcon navKey="vacation" size={20} />
          </SectionHeadingIcon>
        }
        title={`Urlopy — ${departmentLabel}`}
        description="Sprawdź kto z Twojego działu jest na urlopie i zaplanuj swój. Wszyscy w dziale widzą urlopy na wzajem."
      />
      <div className={salesCardBodyClass}>
        {loadError ? (
          <p className="py-4 text-center text-sm text-rose-600">{loadError}</p>
        ) : (
          <StaffVacationCalendar
            staff={staff}
            periodsByUser={periodsByUser}
            currentUserId={user.id}
            isAdmin={adminMode}
            todayDateKey={todayDateKeyInWarsaw()}
          />
        )}
      </div>
      <AppBrandContentFooter mobileOnly variant="page" />
    </Card>
  );
}
