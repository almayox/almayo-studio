import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectCard } from "@/components/ProjectCard";
import { Reveal } from "@/components/Reveal";
import { getCatalogBySlug } from "@/lib/data";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { catalog } = await getCatalogBySlug(slug);
  if (!catalog) return { title: "Catalog" };
  return {
    title: catalog.name,
    description: catalog.description || `${catalog.name} projects by Almayo Studio.`,
  };
}

export default async function CatalogDetailPage({ params }: Props) {
  const { slug } = await params;
  const { catalog, projects } = await getCatalogBySlug(slug);
  if (!catalog) notFound();

  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-32 sm:px-6">
      <Reveal>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy/45">
          Catalog
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-navy sm:text-5xl">
          {catalog.name}
        </h1>
        {catalog.description ? (
          <p className="mt-4 max-w-2xl text-navy/65">{catalog.description}</p>
        ) : null}
        <Link href="/catalogs" className="mt-4 inline-block text-sm font-medium text-navy/70 hover:underline">
          ← All catalogs
        </Link>
      </Reveal>

      {projects.length ? (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, i) => (
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
  );
}
