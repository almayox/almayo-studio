import { ContractsManager } from "@/components/ContractsManager";
import { createClient } from "@/lib/supabase/server";
import type { Client, Contract, Project } from "@/lib/types";

export const metadata = { title: "Contracts" };

export default async function ContractsPage() {
  const supabase = await createClient();
  const [{ data: contracts }, { data: clients }, { data: projects }] = await Promise.all([
    supabase
      .from("contracts")
      .select("*, clients(name), contract_milestones(*)")
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("*").order("name", { ascending: true }),
    supabase.from("projects").select("*").order("title", { ascending: true }),
  ]);

  return (
    <ContractsManager
      initialContracts={(contracts as Contract[]) ?? []}
      clients={(clients as Client[]) ?? []}
      projects={(projects as Project[]) ?? []}
    />
  );
}
