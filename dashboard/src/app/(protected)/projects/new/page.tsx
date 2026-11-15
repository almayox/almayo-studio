import Link from "next/link";
import { ProjectForm } from "@/components/ProjectForm";
import { createClient } from "@/lib/supabase/server";
import type { Catalog, Client } from "@/lib/types";

export const metadata = { title: "New project" };

type Props = { searchParams: Promise<{ client?: string }> };

export default async function NewProjectPage({ searchParams }: Props) {
  const { client: initialClientId } = await searchParams;
  const supabase = await createClient();
  const [{ data: catalogs }, { data: clients }] = await Promise.all([
    supabase.from("catalogs").select("*").order("sort_order", { ascending: true }),
    supabase.from("clients").select("*").order("name", { ascending: true }),
  ]);

  return (
    <div>
      <Link href="/projects" className="text-sm text-navy/55 hover:text-navy">
        ← Back to projects
      </Link>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-navy">
        New project
      </h1>
      <div className="mt-8">
        <ProjectForm
          catalogs={(catalogs as Catalog[]) ?? []}
          clients={(clients as Client[]) ?? []}
          initialClientId={typeof initialClientId === "string" ? initialClientId : ""}
        />
      </div>
    </div>
  );
}
