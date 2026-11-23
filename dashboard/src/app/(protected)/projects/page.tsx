import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";
import { ProjectsTable } from "@/components/ProjectsTable";
import { PageHeader, EmptyState, SummaryCards, primaryBtnClass } from "@/components/ui/PageChrome";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const projects = (data as Project[]) ?? [];

  const [{ data: clientRows }, { data: catalogRows }, { data: contractRows }] = await Promise.all([
    supabase.from("clients").select("id, name"),
    supabase.from("catalogs").select("id, name"),
    supabase.from("contracts").select("project_id, status, created_at").order("created_at"),
  ]);
  const clientNames: Record<string, string> = {};
  for (const row of clientRows ?? []) clientNames[row.id] = row.name;
  const catalogNames: Record<string, string> = {};
  for (const row of catalogRows ?? []) catalogNames[row.id] = row.name;
  // Latest contract per project; a signed one always wins.
  const contractStatus: Record<string, string> = {};
  for (const row of contractRows ?? []) {
    if (!row.project_id) continue;
    if (contractStatus[row.project_id] === "signed") continue;
    contractStatus[row.project_id] = row.status;
  }
  const visibleCount = projects.filter((p) => p.is_visible).length;
  const featuredCount = projects.filter((p) => p.is_featured).length;

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Create and publish portfolio work."
        action={
          <Link href="/projects/new" className={primaryBtnClass}>
            New project
          </Link>
        }
      />

      <SummaryCards
        items={[
          { label: "Total", value: projects.length, tone: "blue" },
          { label: "Published", value: visibleCount, tone: "green" },
          { label: "Featured", value: featuredCount, tone: "purple" },
        ]}
      />

      {projects.length === 0 ? (
        <EmptyState message="No projects yet. Create your first one." />
      ) : (
        <ProjectsTable
          projects={projects}
          clientNames={clientNames}
          catalogNames={catalogNames}
          contractStatus={contractStatus}
        />
      )}
    </div>
  );
}
