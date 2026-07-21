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
        <ProjectsTable projects={projects} />
      )}
    </div>
  );
}
