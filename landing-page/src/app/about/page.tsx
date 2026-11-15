import type { Metadata } from "next";
import Link from "next/link";
import { RemoteImage } from "@/components/RemoteImage";
import { Reveal, RevealItem, RevealStagger } from "@/components/Reveal";
import { getAboutContent, getClients, getProjects, getResume, getSiteSettings } from "@/lib/data";
import {
  DEFAULT_SERVICES,
  FALLBACK_ABOUT,
  parseCertifications,
  parseExperience,
  parseServices,
  parseSkills,
  whatsappLink,
  formatCountriesList,
  type ExperienceItem,
} from "@/lib/content";

export const metadata: Metadata = {
  title: "About",
  description: "About Alemayehu Ibrahim, Almayo Studio.",
};

function experienceTitle(item: ExperienceItem) {
  return item.role || item.title || "Role";
}

export default async function AboutPage() {
  const [about, settings, resume, projects, clients] = await Promise.all([
    getAboutContent(),
    getSiteSettings(),
    getResume(),
    getProjects(),
    getClients(),
  ]);

  const projectCount = projects.length;
  const clientCount = clients.length;
  const countriesLabel = formatCountriesList(settings.countries_list);

  const bio = about.bio?.trim() || FALLBACK_ABOUT.bio;
  const skills = (() => {
    const parsed = parseSkills(about.skills);
    return parsed.length ? parsed : (FALLBACK_ABOUT.skills as string[]);
  })();
  const services = (() => {
    const parsed = parseServices(about.services);
    return parsed.length ? parsed : DEFAULT_SERVICES;
  })();
  const experience = (() => {
    const parsed = parseExperience(about.experience);
    return parsed.length
      ? parsed
      : parseExperience(FALLBACK_ABOUT.experience);
  })();
  const certifications = parseCertifications(about.certifications);

  return (
    <div className="pb-20">
      <div className="mx-auto max-w-6xl px-5 pt-32 sm:px-6">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy/45">
            About Me
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--font-display)] text-4xl text-navy sm:text-5xl">
            Alemayehu Ibrahim (Almayo)
          </h1>
          <p className="mt-3 text-lg text-navy/60">
            {settings.tagline || "Graphic Designer & Software Engineer"}
          </p>
        </Reveal>
      </div>

      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          {about.profile_photo_url ? (
            <Reveal>
              <RemoteImage
                src={about.profile_photo_url}
                alt="Alemayehu Ibrahim"
                className="aspect-square w-full max-w-md rounded-2xl object-cover"
              />
            </Reveal>
          ) : (
            <Reveal className="flex aspect-square max-w-md items-end rounded-2xl bg-foam px-6 py-8 ring-1 ring-mist">
              <div>
                <p className="font-[family-name:var(--font-display)] text-3xl text-navy">
                  Almayo Studio
                </p>
                <p className="mt-2 text-sm text-navy/55">
                  Design + engineering under one practice.
                </p>
              </div>
            </Reveal>
          )}

          <Reveal>
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-navy">
              Who I am
            </h2>
            <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-navy/70">
              {bio}
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="font-[family-name:var(--font-display)] text-3xl text-navy">
                  {settings.years_experience}
                </p>
                <p className="mt-1 text-sm text-navy/55">Years experience</p>
              </div>
              <div>
                <p className="font-[family-name:var(--font-display)] text-3xl text-navy">
                  {settings.countries_served}
                </p>
                <p className="mt-1 text-sm text-navy/55">Countries served</p>
                {countriesLabel ? (
                  <p className="mt-1 text-xs leading-relaxed text-navy/45">{countriesLabel}</p>
                ) : null}
              </div>
              <div>
                <p className="font-[family-name:var(--font-display)] text-3xl text-navy">
                  {clientCount}
                </p>
                <p className="mt-1 text-sm text-navy/55">
                  Client{clientCount === 1 ? "" : "s"}
                </p>
              </div>
              <div>
                <p className="font-[family-name:var(--font-display)] text-3xl text-navy">
                  {projectCount}
                </p>
                <p className="mt-1 text-sm text-navy/55">
                  Project{projectCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-mist bg-foam py-16">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <Reveal className="max-w-2xl">
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-navy">
              What I can do
            </h2>
            <p className="mt-2 text-navy/55">
              Services I deliver for brands, startups, and teams that need design and
              build in the same conversation.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service, i) => (
              <Reveal key={service.title} delay={i * 0.05}>
                <p className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.18em] text-navy/35">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 font-[family-name:var(--font-display)] text-xl text-navy">
                  {service.title}
                </h3>
                {service.description ? (
                  <p className="mt-2 text-sm leading-relaxed text-navy/65">
                    {service.description}
                  </p>
                ) : null}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {skills.length ? (
        <section className="bg-white py-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <Reveal>
              <h2 className="font-[family-name:var(--font-display)] text-3xl text-navy">
                Skills & tools
              </h2>
              <p className="mt-2 text-navy/55">What I use day to day.</p>
            </Reveal>
            <RevealStagger className="mt-6 flex flex-wrap gap-2">
              {skills.map((skill) => (
                <RevealItem key={skill}>
                  <span className="inline-block rounded-xl border border-mist bg-foam px-4 py-2 text-sm text-navy">
                    {skill}
                  </span>
                </RevealItem>
              ))}
            </RevealStagger>
          </div>
        </section>
      ) : null}

      {experience.length ? (
        <section className="border-t border-mist bg-foam py-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <Reveal>
              <h2 className="font-[family-name:var(--font-display)] text-3xl text-navy">
                Experience
              </h2>
              <p className="mt-2 text-navy/55">Selected roles and studio work.</p>
            </Reveal>
            <div className="mt-8 space-y-8">
              {experience.map((item, index) => (
                <Reveal key={`${experienceTitle(item)}-${index}`} delay={index * 0.04}>
                  <article className="border-l-2 border-navy/15 pl-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-[family-name:var(--font-display)] text-xl text-navy">
                        {experienceTitle(item)}
                      </p>
                      {item.period ? (
                        <p className="text-xs font-medium uppercase tracking-wide text-navy/45">
                          {item.period}
                        </p>
                      ) : null}
                    </div>
                    {item.company ? (
                      <p className="mt-1 text-sm font-medium text-navy/60">{item.company}</p>
                    ) : null}
                    {item.description ? (
                      <p className="mt-3 text-sm leading-relaxed text-navy/65">
                        {item.description}
                      </p>
                    ) : null}
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {certifications.length ? (
        <section className="bg-white py-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <Reveal>
              <h2 className="font-[family-name:var(--font-display)] text-3xl text-navy">
                Certifications
              </h2>
            </Reveal>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2">
              {certifications.map((item, index) => (
                <Reveal key={`${item.name}-${index}`} delay={index * 0.04}>
                  <li className="border-l-2 border-navy/15 pl-5">
                    <p className="font-medium text-navy">{item.name}</p>
                    <p className="mt-1 text-sm text-navy/55">
                      {[item.issuer, item.year].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="border-t border-mist bg-white py-14">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <Reveal className="flex flex-wrap items-center gap-3">
            <Link
              href="/projects"
              className="rounded-xl bg-navy px-6 py-3 text-sm font-semibold text-white"
            >
              View projects
            </Link>
            <Link
              href="/contact"
              className="rounded-xl border border-navy/15 px-6 py-3 text-sm font-semibold text-navy"
            >
              Hire Me
            </Link>
            <a
              href={whatsappLink(settings.whatsapp_number)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-navy/15 px-6 py-3 text-sm font-semibold text-navy"
            >
              WhatsApp
            </a>
            {resume?.file_url ? (
              <a
                href={resume.file_url}
                target="_blank"
                rel="noopener noreferrer"
                download={resume.original_name || "Almayo-Resume.pdf"}
                className="rounded-xl border border-navy/15 px-6 py-3 text-sm font-semibold text-navy"
              >
                Download Resume
              </a>
            ) : null}
          </Reveal>
        </div>
      </section>
    </div>
  );
}
