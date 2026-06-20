import { ensureWarehouseSection } from "@/lib/auth/section-layout-guards";

export default async function NotatkiLayout({ children }: { children: React.ReactNode }) {
  await ensureWarehouseSection();
  return children;
}
