import { redirect } from "next/navigation";
import { getAppRole } from "@/lib/auth-dev";
import { homePathForRole } from "@/lib/auth-roles";
import { needsBootstrapSetup } from "@/lib/setup/bootstrap";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (await needsBootstrapSetup()) redirect("/setup");

  const role = await getAppRole();
  if (!role) redirect("/login");
  redirect(homePathForRole(role));
}
