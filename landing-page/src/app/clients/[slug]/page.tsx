import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectCard } from "@/components/ProjectCard";
import { RemoteImage } from "@/components/RemoteImage";
import { Reveal } from "@/components/Reveal";
import { getClientBySlug } from "@/lib/data";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { client } = await getClientBySlug(slug);
  if (!client) return { title: "Client" };
  return {
    title: client.name,
    description: client.work_types ?? undefined,
  };
}

export default async function ClientDetailPage({ params }: Props) {
  const { slug } = await params;
  const { client, projects } = await getClientBySlug(slug);
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-32 sm:px-6">
      <Reveal>
        <Link href="/clients" className="text-sm text-navy/55 hover:text-navy">
          ← All clients
        </Link>
      </Reveal>

      <Reveal className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
        {client.logo_url ? (
          <div className="flex h-20 w-40 items-center justify-center rounded-2xl bg-white ring-1 ring-mist">
            <RemoteImage
              src={client.logo_url}
              alt={client.name}
              className="max-h-14 w-auto object-contain"
            />
          </div>
        ) : null}
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-navy">
            {client.name}
          </h1>
          {client.work_types ? (
            <p className="mt-3 max-w-2xl text-navy/65">{client.work_types}</p>
          ) : null}
          {client.website_url ? (
            <a
              href={client.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-medium text-navy underline"
            >
              Visit website
            </a>
          ) : null}
        </div>
      </Reveal>

      <section className="mt-14">
        <Reveal>
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-navy">
            Related projects
          </h2>
        </Reveal>
        {projects.length ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project, i) => (
              <Reveal key={project.id} delay={i * 0.05}>
                <ProjectCard project={project} />
              </Reveal>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-sm text-navy/55">No public projects linked yet.</p>
        )}
      </section>
    </div>
  );
}
