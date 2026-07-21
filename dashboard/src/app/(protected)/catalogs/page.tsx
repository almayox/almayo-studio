import { CatalogsManager } from "@/components/CatalogsManager";
import { createClient } from "@/lib/supabase/server";
import type { Catalog, CatalogWithStats } from "@/lib/types";

export const metadata = { title: "Catalogs" };

export default async function CatalogsPage() {
  const supabase = await createClient();
  const [{ data: catalogs }, { data: projects }] = await Promise.all([
    supabase.from("catalogs").select("*").order("sort_order", { ascending: true }),
    supabase.from("projects").select("catalog_id"),
  ]);

  const rows = (catalogs as Catalog[]) ?? [];
  const projectCounts: Record<string, number> = {};
  for (const project of projects || []) {
    const catalogId = (project as { catalog_id: string | null }).catalog_id;
    if (!catalogId) continue;
    projectCounts[catalogId] = (projectCounts[catalogId] || 0) + 1;
  }

  const withStats: CatalogWithStats[] = rows.map((catalog) => ({
    ...catalog,
    project_count: projectCounts[catalog.id] || 0,
  }));

  return <CatalogsManager initialCatalogs={withStats} />;
}
