import type { Metadata } from "next";
import { AuthEnteringScreen } from "@/components/auth/AuthEnteringScreen";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("entering");

export const dynamic = "force-dynamic";

export default function AuthEnteringPage() {
  return <AuthEnteringScreen />;
}
