import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isSalesAccount } from "@/lib/auth-roles";
import { DepartmentBoardPlaceholder } from "@/components/department-board/DepartmentBoardPlaceholder";

export default async function SalesBoardPage() {
  const user = await getSessionUser();
  if (!user?.role || !isSalesAccount(user.role)) {
    redirect("/login");
  }

  return <DepartmentBoardPlaceholder audience="sales" />;
}
