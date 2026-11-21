import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toShowItems, toShowPosts } from "@/components/projectMedia";
import { SocialGrid } from "@/components/SocialGrid";
import { VideoShowcase } from "@/components/VideoShowcase";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import { parseYouTubeLink } from "@/lib/youtube";
import { ModelViewer } from "@/components/ModelViewer";
import { ProjectBookTile } from "@/components/ProjectBookTile";
import { ProjectVideo } from "@/components/ProjectVideo";
import { RemoteImage } from "@/components/RemoteImage";
import { Reveal } from "@/components/Reveal";
import { getProjectBySlug } from "@/lib/data";
import { richTextToPlain, sanitizeRichText } from "@/lib/sanitize";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { project } = await getProjectBySlug(slug);
  if (!project) return { title: "Project" };
  return {
    title: project.title,
    description: richTextToPlain(project.description, 160) || undefined,
  };
}

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;
  const { project, media, displayStyle, clientLogo } = await getProjectBySlug(slug);
  if (!project) notFound();

  // Stored rich text is cleaned before it is placed in the page.
  const description = sanitizeRichText(project.description);

  const tags = (project.tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  // What each look takes: the social grid every post, the video page every
  // video. Whatever is left (always the PDFs, which open as books, and 3D models) goes in rows.
  const isVideo = (type: string) => type === "video" || type === "youtube";
  const social = displayStyle === "social" ? toShowPosts(media) : [];
  const videos =
    displayStyle === "video" ? toShowItems(media.filter((item) => isVideo(item.media_type))) : [];
  const standsAlone = (type: string) => type === "pdf" || type === "model";
  const gallery = media.filter((item) =>
    displayStyle === "social"
      ? standsAlone(item.media_type)
      : displayStyle === "video"
        ? !isVideo(item.media_type)
        : true,
  );
  const clientName = project.clients?.name || "Almayo Studio";

  // The cover is taken from the gallery, so it is only shown on top when it is
  // not about to appear again just below.
  const showCover =
    displayStyle === "gallery" &&
    Boolean(project.thumbnail_url) &&
    !media.some(
      (item) => item.url === project.thumbnail_url || item.poster_url === project.thumbnail_url,
    );

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
          {project.clients?.name ? (
            <p className="mt-3 text-sm text-navy/60">
              Client:{" "}
              <Link
                href={`/clients/${project.clients.slug}`}
                className="font-medium text-navy hover:underline"
              >
                {project.clients.name}
              </Link>
            </p>
          ) : null}
          {description ? (
            <div
              className="prose prose-sm mt-5 max-w-none text-navy/70"
              dangerouslySetInnerHTML={{ __html: description }}
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

        {showCover ? (
          <Reveal className="relative mt-10 aspect-[16/9] overflow-hidden rounded-2xl bg-navy/5">
            <RemoteImage
              src={project.thumbnail_url ?? ""}
              alt={project.title}
              fill
              priority
              sizes="(min-width: 1152px) 1104px, 100vw"
              className="h-full w-full object-cover"
              style={{ objectPosition: project.thumbnail_position ?? "50% 50%" }}
            />
          </Reveal>
        ) : null}

        {social.length ? (
          <Reveal className="mt-10">
            <SocialGrid
              profile={{
                name: clientName,
                logo: clientLogo,
                title: project.title,
                subtitle: project.catalogs?.name ?? null,
              }}
              posts={social}
            />
          </Reveal>
        ) : null}

        {videos.length ? (
          <Reveal className="mt-10">
            <VideoShowcase
              videos={videos}
              title={project.title}
              channel={{
                name: clientName,
                logo: clientLogo,
                href: project.clients?.slug ? `/clients/${project.clients.slug}` : null,
              }}
            />
          </Reveal>
        ) : null}

        {gallery.length ? (
          // One row height for everything; each item is as wide as its shape needs.
          <div className="mt-8 flex flex-wrap items-start justify-center gap-4 [--media-row:25rem] sm:justify-start xl:[--media-row:28rem]">
            {gallery.map((item, i) => {
              const youTube = item.media_type === "youtube" ? parseYouTubeLink(item.url) : null;
              if (item.media_type === "pdf" && item.pages?.length) {
                return (
                  <Reveal key={item.id} delay={i * 0.04} className="contents">
                    <ProjectBookTile
                      pages={item.pages}
                      title={item.caption || project.title}
                      rtl={Boolean(item.rtl)}
                    />
                  </Reveal>
                );
              }
              if (item.media_type === "model") {
                return <ModelViewer key={item.id} src={item.url} title={item.caption || project.title} />;
              }
              if (item.media_type === "youtube") {
                if (!youTube) return null;
                return (
                  <div
                    key={item.id}
                    className={`overflow-hidden rounded-2xl bg-black ${
                      youTube.short
                        ? "aspect-[9/16] w-[min(100%,calc(var(--media-row)*9/16))]"
                        : "aspect-video w-[min(100%,calc(var(--media-row)*16/9))]"
                    }`}
                  >
                    <YouTubeEmbed id={youTube.id} title={item.caption || project.title} />
                  </div>
                );
              }
              if (item.media_type === "video") {
                return (
                  <Reveal key={item.id} delay={i * 0.04} className="contents">
                    <ProjectVideo src={item.url} poster={item.poster_url} />
                  </Reveal>
                );
              }
              return (
                <Reveal
                  key={item.id}
                  delay={i * 0.04}
                  className="relative aspect-[4/3] w-[min(100%,calc(var(--media-row)*4/3))] overflow-hidden rounded-2xl bg-navy/5"
                >
                  <RemoteImage
                    src={item.url}
                    alt={item.caption || project.title}
                    fill
                    sizes="(min-width: 1152px) 640px, 100vw"
                    className="h-full w-full object-cover"
                  />
                </Reveal>
              );
            })}
          </div>
        ) : null}
      </article>
    </>
  );
}
