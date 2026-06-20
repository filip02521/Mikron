import { ensureAdminSection } from "@/lib/auth/section-layout-guards";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await ensureAdminSection();
  return children;
}
