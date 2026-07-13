import { getSessionUser } from "@/lib/auth";
import { canAccessOperationsNotepad } from "@/lib/operations/notepad-department";
import { redirect } from "next/navigation";

export default async function NotatkiLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user?.role || !canAccessOperationsNotepad(user.role, user.assignedWorkspaces)) {
    redirect("/login");
  }
  return children;
}
