import Link from "next/link";
import { ClientCard } from "@/components/ClientCard";
import { Hero } from "@/components/Hero";
import { ProjectCard } from "@/components/ProjectCard";
import { Reveal, RevealItem, RevealStagger } from "@/components/Reveal";
import {
  getAboutContent,
  getClients,
  getProjects,
  getSiteSettings,
} from "@/lib/data";
import { parseSkills, parseTestimonials } from "@/lib/content";

const PROCESS_STEPS = [
  {
    step: "01",
    title: "Brief",
    body: "We clarify goals, audience, and constraints so the work starts pointed in the right direction.",
  },
  {
    step: "02",
    title: "Design & build",
    body: "Concepts move into polished design and production-ready systems, sites, or campaigns.",
  },
  {
    step: "03",
    title: "Launch",
    body: "We refine, hand off, and support go-live so the result holds up past the first release.",
  },
];

export default async function HomePage() {
  const [settings, about, featured, allProjects, clients] = await Promise.all([
    getSiteSettings(),
    getAboutContent(),
    getProjects({ featuredOnly: true }),
    getProjects(),
    getClients(),
  ]);

  const projects = (featured.length ? featured : allProjects).slice(0, 6);
  const skills = parseSkills(about.skills);
  const projectCount = allProjects.length;
  const testimonials = parseTestimonials(settings.testimonials).slice(0, 3);
  const visibleClients = clients.slice(0, 10);
  const stats = [
    { value: settings.years_experience, label: "Years Experience" },
    { value: projectCount, label: "Projects Delivered" },
    { value: clients.length, label: "Happy Clients" },
    { value: settings.countries_served, label: "Countries Served" },
  ]
    .map((stat) => ({ ...stat, value: String(stat.value ?? "").trim() }))
    .filter((stat) => stat.value !== "" && stat.value !== "0");

  return (
    <>
      <Hero
        siteName={settings.hero_title || settings.site_name}
        subtitle={settings.hero_subtitle || settings.tagline}
        tagline={settings.hero_tagline}
        whatsappNumber={settings.whatsapp_number}
      />

      {stats.length >= 2 ? (
        <section className="border-b border-mist bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-y-8 px-2 py-12 sm:px-3">
            {stats.map((stat) => (
              <Reveal key={stat.label} className="w-1/2 px-3 text-center sm:w-1/4">
                <p className="font-[family-name:var(--font-display)] text-3xl text-navy sm:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm font-medium text-navy/55">{stat.label}</p>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {skills.length > 0 ? (
        <section className="bg-foam py-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <Reveal className="mb-10 text-center">
              <h2 className="font-[family-name:var(--font-display)] text-3xl text-navy">
                What I Do
              </h2>
              <p className="mt-2 text-navy/55">Skills & tools I work with</p>
            </Reveal>
            <RevealStagger className="flex flex-wrap justify-center gap-3">
              {skills.map((skill) => (
                <RevealItem key={skill}>
                  <span className="inline-block rounded-xl border border-mist bg-white px-4 py-2 text-sm font-medium text-navy shadow-sm">
                    {skill}
                  </span>
                </RevealItem>
              ))}
            </RevealStagger>
          </div>
        </section>
      ) : null}

      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <Reveal className="mb-10 flex items-end justify-between gap-6">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-3xl text-navy">
                Featured Work
              </h2>
              <p className="mt-1 text-navy/55">Handpicked highlights from my portfolio</p>
            </div>
            <Link
              href="/projects"
              className="hidden text-sm font-medium text-navy hover:underline sm:inline"
            >
              View all →
            </Link>
          </Reveal>

          {projects.length ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project, i) => (
                <Reveal key={project.id} delay={i * 0.06}>
                  <ProjectCard project={project} />
                </Reveal>
              ))}
            </div>
          ) : (
            <Reveal>
              <p className="text-navy/65">
                New work is on its way.{" "}
                <Link href="/contact" className="font-medium text-navy underline underline-offset-4">
                  Get in touch
                </Link>{" "}
                to see recent projects.
              </p>
            </Reveal>
          )}
        </div>
      </section>

      <section className="border-t border-mist bg-foam py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <Reveal className="mb-12 max-w-xl">
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-navy">
              How I work
            </h2>
            <p className="mt-2 text-navy/55">
              A clear path from first conversation to a launch you can stand behind.
            </p>
          </Reveal>
          <div className="grid gap-10 md:grid-cols-3 md:gap-8">
            {PROCESS_STEPS.map((item, i) => (
              <Reveal key={item.step} delay={i * 0.06}>
                <p className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.2em] text-navy/35">
                  {item.step}
                </p>
                <h3 className="mt-3 font-[family-name:var(--font-display)] text-2xl text-navy">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-navy/65">{item.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {testimonials.length > 0 ? (
        <section className="bg-white py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <Reveal className="mb-12 max-w-xl">
              <h2 className="font-[family-name:var(--font-display)] text-3xl text-navy">
                Client words
              </h2>
              <p className="mt-2 text-navy/55">What partners say after we ship.</p>
            </Reveal>
            <div
              className={`grid gap-12 ${
                testimonials.length > 1 ? "md:grid-cols-2 lg:grid-cols-3" : "max-w-3xl"
              }`}
            >
              {testimonials.map((item, i) => (
                <Reveal key={`${item.name}-${i}`} delay={i * 0.06}>
                  <blockquote>
                    <p className="text-lg leading-relaxed text-navy/80">
                      “{item.quote}”
                    </p>
                    <footer className="mt-5">
                      <p className="font-medium text-navy">{item.name}</p>
                      {item.role || item.company ? (
                        <p className="mt-1 text-sm text-navy/50">
                          {[item.role, item.company].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </footer>
                  </blockquote>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {visibleClients.length > 0 ? (
        <section className={testimonials.length > 0 ? "bg-foam py-16" : "bg-white py-16"}>
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <Reveal className="mb-10 text-center">
              <h2 className="font-[family-name:var(--font-display)] text-3xl text-navy">
                Brands I’ve Worked With
              </h2>
            </Reveal>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visibleClients.map((client, i) => (
                <Reveal key={client.id} delay={i * 0.04}>
                  <ClientCard client={client} />
                </Reveal>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link href="/clients" className="text-sm font-medium text-navy hover:underline">
                View all clients →
              </Link>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
