import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";
import {
  parseZdEstimateExtrasPolicy,
  serializeZdEstimateExtrasPolicy,
  ZD_ESTIMATE_EXTRAS_POLICY_DEFAULT,
  ZD_ESTIMATE_EXTRAS_POLICY_SETTING_KEY,
  type ZdEstimateExtrasPolicy,
} from "@/lib/orders/zd-estimate-extras-policy";

export async function fetchZdEstimateExtrasPolicy(): Promise<ZdEstimateExtrasPolicy> {
  if (!hasSupabaseConfig()) return ZD_ESTIMATE_EXTRAS_POLICY_DEFAULT;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", ZD_ESTIMATE_EXTRAS_POLICY_SETTING_KEY)
    .maybeSingle();
  if (error) {
    console.error("fetchZdEstimateExtrasPolicy:", error.message);
    return ZD_ESTIMATE_EXTRAS_POLICY_DEFAULT;
  }
  return parseZdEstimateExtrasPolicy(data?.value ?? null);
}

export async function upsertZdEstimateExtrasPolicy(
  policy: ZdEstimateExtrasPolicy
): Promise<ZdEstimateExtrasPolicy> {
  const normalized = parseZdEstimateExtrasPolicy(policy);
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert({
    key: ZD_ESTIMATE_EXTRAS_POLICY_SETTING_KEY,
    value: serializeZdEstimateExtrasPolicy(normalized),
  });
  if (error) throw new Error(error.message);
  return normalized;
}
