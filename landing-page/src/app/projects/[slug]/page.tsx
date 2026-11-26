import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toShowItems, toShowPosts } from "@/components/projectMedia";
import { StickyColumn } from "@/components/StickyColumn";
import { SocialGrid } from "@/components/SocialGrid";
import { VideoShowcase } from "@/components/VideoShowcase";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import { parseYouTubeLink } from "@/lib/youtube";
import { DeviceScreen } from "@/components/DeviceScreen";
import { ModelViewer } from "@/components/ModelViewer";
import { ProjectBookTile } from "@/components/ProjectBookTile";
import { ProjectVideo } from "@/components/ProjectVideo";
import { ProjectImage } from "@/components/ProjectImage";
import { RemoteImage } from "@/components/RemoteImage";
import { Reveal } from "@/components/Reveal";
import { getProjectBySlug } from "@/lib/data";
import {
  richTextToPlain,
  sanitizeRichText,
  splitRichText,
} from "@/lib/sanitize";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { project } = await getProjectBySlug(slug);
  if (!project) return { title: "Project" };
  const description = richTextToPlain(project.description, 160) || undefined;
  return {
    title: project.title,
    description,
    // The picture comes from opengraph-image.tsx beside this file.
    openGraph: {
      title: project.title,
      description,
      url: "./",
      siteName: "Almayo Studio",
      type: "article",
    },
    twitter: { card: "summary_large_image", title: project.title, description },
  };
}

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;
  const { project, media, displayStyle, links, clientLogo } =
    await getProjectBySlug(slug);
  if (!project) notFound();

  // Stored rich text is cleaned before it is placed in the page.
  // It is then split at its headings: the opening text sits under the title,
  // and each headed part gets a card of its own.
  const { intro, sections } = splitRichText(
    sanitizeRichText(project.description),
  );

  const tags = (project.tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const techStack = (project.tech_stack || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  // Where a visitor can try the finished work.
  const linkButtons = [
    { href: links.live, label: "Visit website" },
    { href: links.appStore, label: "App Store" },
    { href: links.playStore, label: "Google Play" },
  ].filter((link): link is { href: string; label: string } =>
    Boolean(link.href),
  );
  // The address shown in a browser frame: the live site's, without "www.".
  let address: string | null = null;
  try {
    if (links.live)
      address = new URL(links.live).hostname.replace(/^www\./, "");
  } catch {
    address = null;
  }

  // The cards under the title: the headed parts of the text on one side, the
  // tech stack and links on the other.
  const hasFacts = techStack.length > 0 || linkButtons.length > 0;

  // What each look takes: the social grid every post, the video page every
  // video. Whatever is left (always the PDFs, which open as books, and 3D models) goes in rows.
  const isVideo = (type: string) => type === "video" || type === "youtube";
  const social = displayStyle === "social" ? toShowPosts(media) : [];
  const videos =
    displayStyle === "video"
      ? toShowItems(media.filter((item) => isVideo(item.media_type)))
      : [];
  const standsAlone = (type: string) => type === "pdf" || type === "model";
  const gallery = media.filter((item) =>
    displayStyle === "social"
      ? standsAlone(item.media_type)
      : displayStyle === "video"
        ? !isVideo(item.media_type)
        : // A designed cover is for the project card only.
          !(displayStyle === "web" && item.device === "cover"),
  );
  // A single 3D model leads the page at full width; several sit two to a row.
  const modelCount = gallery.filter(
    (item) => item.media_type === "model",
  ).length;
  const clientName = project.clients?.name || "Almayo Studio";

  // The cover is taken from the gallery, so it is only shown on top when it is
  // not about to appear again just below.
  const showCover =
    displayStyle === "gallery" &&
    Boolean(project.thumbnail_url) &&
    !media.some(
      (item) =>
        item.url === project.thumbnail_url ||
        item.poster_url === project.thumbnail_url,
    );

  // On the Website / App look the text stays on the left of a wide screen
  // while the screens scroll past on the right.
  const split = displayStyle === "web" && gallery.length > 0;
  // A file can be set to sit beside one headed part of the text. Those parts
  // follow in rows of their own; the rest of the files sit beside the opening.
  const beside = (index: number) =>
    split ? gallery.filter((item) => item.section === index + 1) : [];
  const numbered = sections.map((section, index) => ({
    section,
    index,
    items: beside(index),
  }));
  const paired = numbered.filter((part) => part.items.length);
  const loose = numbered.filter((part) => !part.items.length);
  const opening = gallery.filter(
    (item) => !paired.some((part) => part.items.includes(item)),
  );
  const splitTop = split && opening.length > 0;
  const TextColumn = splitTop ? StickyColumn : Fragment;

  const card = (narrow: boolean) =>
    `rounded-3xl bg-white p-6 ring-1 ring-mist sm:p-7 ${narrow ? "lg:p-5" : ""}`;
  const cardLabel =
    "text-xs font-medium uppercase tracking-[0.22em] text-navy/45";

  // One headed part of the text as a card. In a narrow column a point of a
  // list is one compact row; as the lead of its own row the heading is larger.
  const renderSection = (
    section: (typeof sections)[number],
    narrow: boolean,
    lead = false,
  ) => (
    <section className={card(narrow)}>
      {section.title ? (
        <h2
          className={
            lead
              ? "font-[family-name:var(--font-display)] text-2xl text-navy"
              : cardLabel
          }
        >
          {section.title}
        </h2>
      ) : null}
      {/* Each point of a list is a numbered tile. */}
      <div
        className={`${narrow ? "lg:[&_li]:py-3 lg:[&_li]:pl-12 lg:[&_ol]:grid-cols-1 lg:[&_ol]:gap-2 lg:[&_ul]:grid-cols-1 lg:[&_ul]:gap-2" : ""} prose prose-sm mt-4 max-w-none text-navy/75 [&_li]:relative [&_li]:m-0 [&_li]:rounded-2xl [&_li]:bg-background [&_li]:p-4 [&_li]:pt-10 [&_li]:[counter-increment:point] [&_li]:before:absolute [&_li]:before:left-4 [&_li]:before:top-3.5 [&_li]:before:text-xs [&_li]:before:font-semibold [&_li]:before:tracking-widest [&_li]:before:text-navy/35 [&_li]:before:content-[counter(point,decimal-leading-zero)] [&_li>p]:m-0 [&_ol]:m-0 [&_ol]:grid [&_ol]:list-none [&_ol]:gap-3 [&_ol]:p-0 [&_ol]:[counter-reset:point] sm:[&_ol]:grid-cols-2 [&_ul]:m-0 [&_ul]:grid [&_ul]:list-none [&_ul]:gap-3 [&_ul]:p-0 [&_ul]:[counter-reset:point] sm:[&_ul]:grid-cols-2 [&>:first-child]:mt-0 [&>:last-child]:mb-0`}
        dangerouslySetInnerHTML={{ __html: section.html }}
      />
    </section>
  );

  const renderGallery = (items: typeof gallery, spacing: string) =>
    items.length ? (
      // Videos, books and models share one row height and are as wide as their
      // shape needs. Images use a lower row and stretch to fill it, as a grid.
      <div
        className={`${spacing} flex flex-wrap items-start justify-center ${displayStyle === "web" ? "gap-6" : "gap-4"} [--image-row:15rem] [--media-row:25rem] sm:[--image-row:18rem] xl:[--media-row:28rem]`}
      >
        {items.map((item, i) => {
          const youTube =
            item.media_type === "youtube" ? parseYouTubeLink(item.url) : null;
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
            return (
              <ModelViewer
                key={item.id}
                src={item.url}
                title={item.caption || project.title}
                wide={modelCount === 1}
              />
            );
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
                <YouTubeEmbed
                  id={youTube.id}
                  title={item.caption || project.title}
                />
              </div>
            );
          }
          if (
            displayStyle === "web" &&
            (item.media_type === "video" || item.media_type === "image")
          ) {
            return (
              <Reveal key={item.id} delay={i * 0.04} className="contents">
                <DeviceScreen
                  src={item.url}
                  alt={item.caption || project.title}
                  video={item.media_type === "video"}
                  poster={item.poster_url}
                  address={address}
                  device={item.device === "cover" ? null : item.device}
                />
              </Reveal>
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
            <Reveal key={item.id} delay={i * 0.04} className="contents">
              <ProjectImage
                src={item.url}
                alt={item.caption || project.title}
              />
            </Reveal>
          );
        })}
      </div>
    ) : null;

  return (
    <>
      <article className="mx-auto max-w-6xl px-5 pb-16 pt-32 sm:px-6">
        <Reveal>
          <Link
            href="/projects"
            className="text-sm text-navy/55 hover:text-navy"
          >
            ← All projects
          </Link>
        </Reveal>

        <div
          className={
            splitTop
              ? "lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-12"
              : undefined
          }
        >
          <TextColumn>
            <Reveal className="mt-6 max-w-3xl">
              {project.catalogs?.name ? (
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy/45">
                  {project.catalogs.name}
                </p>
              ) : null}
              <h1
                className={`mt-3 font-[family-name:var(--font-display)] text-4xl text-navy sm:text-5xl ${splitTop ? "lg:text-4xl" : ""}`}
              >
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
              {intro ? (
                <div
                  className="prose mt-5 max-w-none text-navy/70"
                  dangerouslySetInnerHTML={{ __html: intro }}
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

            {loose.length || hasFacts ? (
              <div
                className={`mt-10 grid items-start gap-5 ${
                  loose.length && hasFacts && !splitTop ? "lg:grid-cols-3" : ""
                }`}
              >
                {loose.length ? (
                  <div
                    className={`grid gap-5 ${hasFacts && !splitTop ? "lg:col-span-2" : ""}`}
                  >
                    {loose.map(({ section, index }) => (
                      <Reveal key={index} delay={index * 0.04}>
                        {renderSection(section, splitTop)}
                      </Reveal>
                    ))}
                  </div>
                ) : null}

                {hasFacts ? (
                  <div
                    className={`grid gap-5 ${
                      loose.length
                        ? ""
                        : splitTop
                          ? "sm:grid-cols-2 lg:grid-cols-1"
                          : "sm:grid-cols-2"
                    }`}
                  >
                    {techStack.length ? (
                      <Reveal delay={0.06}>
                        <section className={card(splitTop)}>
                          <h2 className={cardLabel}>Tech stack</h2>
                          <ul className="mt-4 flex flex-wrap gap-2">
                            {techStack.map((tech) => (
                              <li
                                key={tech}
                                className="rounded-lg bg-navy px-3 py-1.5 text-xs font-medium text-white"
                              >
                                {tech}
                              </li>
                            ))}
                          </ul>
                        </section>
                      </Reveal>
                    ) : null}
                    {linkButtons.length ? (
                      <Reveal delay={0.1}>
                        <section className={card(splitTop)}>
                          <h2 className={cardLabel}>See it live</h2>
                          <div className="mt-4 grid gap-2.5">
                            {linkButtons.map((link, index) => (
                              <a
                                key={link.label}
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition ${
                                  index === 0
                                    ? "bg-navy text-white hover:bg-navy/85"
                                    : "bg-white text-navy ring-1 ring-mist hover:ring-navy/40"
                                }`}
                              >
                                {link.label}
                                <span aria-hidden>↗</span>
                              </a>
                            ))}
                          </div>
                        </section>
                      </Reveal>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </TextColumn>
          {splitTop ? renderGallery(opening, "mt-10 lg:mt-6") : null}
        </div>

        {showCover ? (
          <Reveal className="relative mt-10 aspect-[16/9] overflow-hidden rounded-2xl bg-navy/5">
            <RemoteImage
              src={project.thumbnail_url ?? ""}
              alt={project.title}
              fill
              priority
              sizes="(min-width: 1152px) 1104px, 100vw"
              className="h-full w-full object-cover"
              style={{
                objectPosition: project.thumbnail_position ?? "50% 50%",
              }}
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
                href: project.clients?.slug
                  ? `/clients/${project.clients.slug}`
                  : null,
              }}
            />
          </Reveal>
        ) : null}

        {/* Each part of the text that has screens of its own: the text stays
            in view on the left while its screens scroll past on the right. */}
        {paired.map(({ section, index, items }) => (
          <div
            key={index}
            className="mt-14 lg:mt-24 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-12"
          >
            <StickyColumn>
              <Reveal>{renderSection(section, true, true)}</Reveal>
            </StickyColumn>
            {renderGallery(items, "mt-6 lg:mt-0")}
          </div>
        ))}

        {split ? null : renderGallery(gallery, "mt-8")}
      </article>
    </>
  );
}
