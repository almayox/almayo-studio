import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectForm } from "@/components/ProjectForm";
import { createClient } from "@/lib/supabase/server";
import type { Catalog, Client, Project, ProjectMedia } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

export const metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: project }, { data: catalogs }, { data: clients }, { data: media }] =
    await Promise.all([
      supabase.from("projects").select("*").eq("id", id).maybeSingle(),
      supabase.from("catalogs").select("*").order("sort_order", { ascending: true }),
      supabase.from("clients").select("*").order("name", { ascending: true }),
      supabase
        .from("project_media")
        .select("*")
        .eq("project_id", id)
        .order("sort_order", { ascending: true }),
    ]);

  const { data: contracts } = await supabase
    .from("contracts")
    .select("status, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: false });
  const contractStatus =
    contracts?.find((c) => c.status === "signed")?.status ?? contracts?.[0]?.status ?? null;

  if (!project) notFound();

  return (
    <div>
      <Link href="/projects" className="text-sm text-navy/55 hover:text-navy">
        ← Back to projects
      </Link>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-navy">
        Edit project
      </h1>
      <div className="mt-8">
        <ProjectForm
          catalogs={(catalogs as Catalog[]) ?? []}
          clients={(clients as Client[]) ?? []}
          project={project as Project}
          media={(media as ProjectMedia[]) ?? []}
          contractStatus={contractStatus}
        />
      </div>
    </div>
  );
}
