import { notFound } from "next/navigation";
import { E2ELabClient } from "./E2ELabClient";

export default function E2ELabPage() {
  if (process.env.E2E_LAB !== "1" || process.env.NODE_ENV === "production") {
    notFound();
  }

  return <E2ELabClient />;
}
