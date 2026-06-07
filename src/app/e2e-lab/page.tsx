import { notFound } from "next/navigation";
import { E2ELabClient } from "./E2ELabClient";

/** Runtime env — CI uruchamia `next start` (production), więc nie można polegać na NODE_ENV. */
export const dynamic = "force-dynamic";

export default function E2ELabPage() {
  if (process.env.E2E_LAB !== "1") {
    notFound();
  }

  return <E2ELabClient />;
}
