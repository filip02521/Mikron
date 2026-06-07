import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canAccessOperations } from "@/lib/auth-roles";
import { DepartmentBoardPlaceholder } from "@/components/department-board/DepartmentBoardPlaceholder";
import { adminPageShellClass } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";

export default async function ProcurementBoardPage() {
  const user = await getSessionUser();
  if (!user?.role || !canAccessOperations(user.role)) {
    redirect("/login");
  }

  return (
    <div className={cn(adminPageShellClass)}>
      <DepartmentBoardPlaceholder audience="procurement" />
    </div>
  );
}
