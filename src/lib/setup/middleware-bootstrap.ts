import { isE2ELab } from "@/lib/e2e-lab/mode";
import { needsBootstrapSetup } from "@/lib/setup/bootstrap";

/**
 * Historycznie używane w proxy — zostawione dla testów / kompatybilności.
 * Proxy już nie wymusza /setup (uniknięcie ERR_TOO_MANY_REDIRECTS).
 */
export async function middlewareNeedsBootstrap(): Promise<boolean> {
  if (isE2ELab()) return false;
  return needsBootstrapSetup();
}
