import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RemoteImage } from "@/components/RemoteImage";
import { Reveal } from "@/components/Reveal";
import { getProjectBySlug } from "@/lib/data";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { project } = await getProjectBySlug(slug);
  if (!project) return { title: "Project" };
  return {
    title: project.title,
    description: project.description ?? undefined,
  };
}

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;
  const { project, media } = await getProjectBySlug(slug);
  if (!project) notFound();

  const tags = (project.tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <>
      <article className="mx-auto max-w-6xl px-5 pb-16 pt-32 sm:px-6">
        <Reveal>
          <Link href="/projects" className="text-sm text-navy/55 hover:text-navy">
            ← All projects
          </Link>
        </Reveal>

        <Reveal className="mt-6 max-w-3xl">
          {project.catalogs?.name ? (
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy/45">
              {project.catalogs.name}
            </p>
          ) : null}
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-navy sm:text-5xl">
            {project.title}
          </h1>
          {project.description ? (
            <div
              className="prose prose-sm mt-5 max-w-none text-navy/70"
              dangerouslySetInnerHTML={{ __html: project.description }}
            />
          ) : null}
          {tags.length ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-xl bg-white px-3 py-1 text-xs font-medium text-navy/70 ring-1 ring-mist"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </Reveal>

        {project.thumbnail_url ? (
          <Reveal className="relative mt-10 aspect-[16/9] overflow-hidden rounded-2xl bg-navy/5">
            <RemoteImage
              src={project.thumbnail_url}
              alt={project.title}
              className="h-full w-full object-cover"
              style={{ objectPosition: project.thumbnail_position ?? "50% 50%" }}
            />
          </Reveal>
        ) : null}

        {media.length ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {media.map((item, i) => (
              <Reveal
                key={item.id}
                delay={i * 0.04}
                className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-navy/5"
              >
                {item.media_type === "video" ? (
                  <video src={item.url} controls className="h-full w-full object-cover" />
                ) : (
                  <RemoteImage
                    src={item.url}
                    alt={item.caption || project.title}
                    className="h-full w-full object-cover"
                  />
                )}
              </Reveal>
            ))}
          </div>
        ) : null}
      </article>
    </>
  );
}
