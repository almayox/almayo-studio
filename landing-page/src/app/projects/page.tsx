import type { Metadata } from "next";
import Link from "next/link";
import { ProjectCard } from "@/components/ProjectCard";
import { ProjectRow } from "@/components/ProjectRow";
import { Reveal } from "@/components/Reveal";
import { getCatalogs, getProjects } from "@/lib/data";

export const metadata: Metadata = {
  title: "Work",
  description: "Selected design and software projects by Almayo Studio.",
};

type Props = { searchParams: Promise<{ catalog?: string }> };

export default async function ProjectsPage({ searchParams }: Props) {
  const { catalog: catalogSlug } = await searchParams;
  const [projects, catalogs] = await Promise.all([getProjects(), getCatalogs()]);

  const activeCatalog = catalogs.find((c) => c.slug === catalogSlug);
  const filtered = activeCatalog
    ? projects.filter((p) => p.catalog_id === activeCatalog.id)
    : projects;

  // The full list is shown one category per row; work with no category comes last.
  const rows = [
    ...catalogs.map((catalog) => ({
      title: catalog.name,
      href: `/projects?catalog=${catalog.slug}`,
      projects: projects.filter((p) => p.catalog_id === catalog.id),
    })),
    {
      title: "More work",
      href: undefined as string | undefined,
      projects: projects.filter((p) => !catalogs.some((c) => c.id === p.catalog_id)),
    },
  ].filter((row) => row.projects.length);

  return (
    <>
      <div className="mx-auto max-w-6xl px-5 pb-16 pt-32 sm:px-6">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy/45">
            Portfolio
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-navy sm:text-5xl">
            {activeCatalog ? activeCatalog.name : "Featured Work"}
          </h1>
          <p className="mt-4 max-w-2xl text-navy/65">
            {activeCatalog?.description ||
              "Brand systems, digital products, and campaign work built end to end."}
          </p>
        </Reveal>

        {catalogs.length ? (
          <div className="mt-8 flex flex-wrap gap-2">
            <Link
              href="/projects"
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                !activeCatalog
                  ? "bg-navy text-white"
                  : "bg-white text-navy/70 ring-1 ring-mist hover:text-navy"
              }`}
            >
              All
            </Link>
            {catalogs.map((catalog) => (
              <Link
                key={catalog.id}
                href={`/projects?catalog=${catalog.slug}`}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                  activeCatalog?.id === catalog.id
                    ? "bg-navy text-white"
                    : "bg-white text-navy/70 ring-1 ring-mist hover:text-navy"
                }`}
              >
                {catalog.name}
              </Link>
            ))}
          </div>
        ) : null}

        {!activeCatalog && rows.length ? (
          // Every category as its own sliding row.
          rows.map((row) => (
            <ProjectRow key={row.title} title={row.title} href={row.href}>
              {row.projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </ProjectRow>
          ))
        ) : filtered.length ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((project, i) => (
              <Reveal key={project.id} delay={i * 0.05}>
                <ProjectCard project={project} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="mt-12 rounded-2xl border border-dashed border-mist bg-white px-6 py-16 text-center">
            <p className="font-[family-name:var(--font-display)] text-xl text-navy">
              No projects in this catalog yet
            </p>
          </div>
        )}
      </div>
    </>
  );
}
