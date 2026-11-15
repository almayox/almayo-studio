import type { SupabaseClient } from "@supabase/supabase-js";

function allowedEmailsFromEnv() {
  return (process.env.ADMIN_ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Whether the signed-in user may use the dashboard. Fails closed: when the
 * check cannot be completed, access is denied.
 *
 * 1. ADMIN_ALLOWED_EMAILS (comma separated) when set.
 * 2. Otherwise the admin_allowlist table, through the is_admin() function
 *    (supabase/schema_launch_1_before_deploy.sql).
 */
export async function isAllowedAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) return false;
  const envList = allowedEmailsFromEnv();
  if (envList.length > 0) return envList.includes(email.toLowerCase());

  try {
    const { data, error } = await supabase.rpc("is_admin");
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}
