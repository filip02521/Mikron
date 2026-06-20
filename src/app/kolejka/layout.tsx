import { ensureWarehouseSection } from "@/lib/auth/section-layout-guards";

export default async function KolejkaLayout({ children }: { children: React.ReactNode }) {
  await ensureWarehouseSection();
  return children;
}
