import Link from "next/link";
import { RemoteImage } from "@/components/RemoteImage";
import { richTextToPlain } from "@/lib/sanitize";
import type { ProjectWithCatalog } from "@/lib/types";

export function ProjectCard({
  project,
  priority = false,
}: {
  project: ProjectWithCatalog;
  priority?: boolean;
}) {
  const summary = richTextToPlain(project.description, 180);
  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group block h-full overflow-hidden rounded-2xl border border-mist bg-white transition duration-300 hover:-translate-y-0.5 hover:border-navy/25 hover:shadow-[0_20px_40px_-28px_rgba(10,31,68,0.55)]"
    >
      <div className="relative aspect-video overflow-hidden bg-navy/5">
        {project.thumbnail_url ? (
          <RemoteImage
            src={project.thumbnail_url}
            alt={project.title}
            fill
            sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
            priority={priority}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            style={{ objectPosition: project.thumbnail_position ?? "50% 50%" }}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-navy to-navy-deep text-white/35">
            <span className="font-[family-name:var(--font-display)] text-3xl">
              {project.title.slice(0, 1)}
            </span>
          </div>
        )}
      </div>
      <div className="space-y-2 p-5">
        <h3 className="font-[family-name:var(--font-display)] text-lg text-navy transition group-hover:text-navy/80">
          {project.title}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {project.catalogs?.name ? (
            <span className="inline-block rounded-lg bg-navy/5 px-2.5 py-1 text-xs font-medium text-navy/70">
              {project.catalogs.name}
            </span>
          ) : null}
          {project.clients?.name ? (
            <span className="text-xs text-navy/50">for {project.clients.name}</span>
          ) : null}
        </div>
        {summary ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-navy/60">{summary}</p>
        ) : null}
      </div>
    </Link>
  );
}
