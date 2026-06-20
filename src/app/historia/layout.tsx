import { ensureOperationsSection } from "@/lib/auth/section-layout-guards";

export default async function HistoriaLayout({ children }: { children: React.ReactNode }) {
  await ensureOperationsSection();
  return children;
}
