import { createAdminClient } from "@/lib/supabase/admin";

export async function getContractByToken(token: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contracts")
    .select("*, contract_milestones(*)")
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;
  if (!["sent", "signed"].includes(data.status)) return null;
  return data;
}
