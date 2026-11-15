import type { MetadataRoute } from "next";
import { getCatalogs, getClients, getProjects } from "@/lib/data";
import { SITE_URL } from "@/lib/site";

const STATIC_ROUTES = [
  "/",
  "/about",
  "/projects",
  "/catalogs",
  "/clients",
  "/contact",
  "/resume",
  "/privacy",
];

// Reads live content, so it is generated per request rather than at build time.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: route === "/" ? SITE_URL : `${SITE_URL}${route}`,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));

  // A database problem should still leave the static routes in the sitemap.
  try {
    const [projects, catalogs, clients] = await Promise.all([
      getProjects(),
      getCatalogs(),
      getClients(),
    ]);

    for (const project of projects) {
      if (!project.slug) continue;
      const modified = project.updated_at ? new Date(project.updated_at) : null;
      entries.push({
        url: `${SITE_URL}/projects/${encodeURIComponent(project.slug)}`,
        ...(modified && !Number.isNaN(modified.getTime()) ? { lastModified: modified } : {}),
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
    for (const catalog of catalogs) {
      if (!catalog.slug) continue;
      entries.push({
        url: `${SITE_URL}/catalogs/${encodeURIComponent(catalog.slug)}`,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
    for (const client of clients) {
      if (!client.slug) continue;
      entries.push({
        url: `${SITE_URL}/clients/${encodeURIComponent(client.slug)}`,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  } catch (error) {
    console.error("sitemap: could not load dynamic routes", error);
  }

  return entries;
}
