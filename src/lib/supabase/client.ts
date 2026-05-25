import { ensureCryptoRandomUUID } from "@/lib/ensure-crypto";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";

ensureCryptoRandomUUID();

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: supabaseCookieOptions() }
  );
}
