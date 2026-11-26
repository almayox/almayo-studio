import type { Metadata } from "next";
import Link from "next/link";
import { RemoteImage } from "@/components/RemoteImage";
import { Reveal, RevealItem, RevealStagger } from "@/components/Reveal";
import {
  getAboutContent,
  getClients,
  getProjects,
  getResume,
  getSiteSettings,
  getSocialLinks,
} from "@/lib/data";
import { sanitizeRichText } from "@/lib/sanitize";
import {
  DEFAULT_SERVICES,
  FALLBACK_ABOUT,
  LANGUAGES,
  PRACTICE_SINCE,
  yearsOfExperience,
  yearsSince,
  parseCertifications,
  parseExperience,
  parseServices,
  parseSkills,
  whatsappLink,
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
  const [about, settings, resume, projects, clients, socialLinks] =
    await Promise.all([
      getAboutContent(),
      getSiteSettings(),
      getResume(),
      getProjects(),
      getClients(),
      getSocialLinks(),
    ]);
  const instagram = socialLinks.find((link) =>
    /instagram/i.test(`${link.platform} ${link.url}`),
  );
  // Counted from the year I started, so it moves on by itself.
  const now = new Date();

  const projectCount = projects.length;
  const clientCount = clients.length;

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
    return parsed.length ? parsed : parseExperience(FALLBACK_ABOUT.experience);
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
                  {yearsOfExperience(now)}+
                </p>
                <p className="mt-1 text-sm text-navy/55">Years experience</p>
              </div>
              <div>
                <p className="font-[family-name:var(--font-display)] text-3xl text-navy">
                  {settings.countries_served}
                </p>
                <p className="mt-1 text-sm text-navy/55">Countries served</p>
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

      <section className="bg-navy py-16 text-white">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <Reveal className="max-w-2xl">
            <h2 className="font-[family-name:var(--font-display)] text-3xl">
              Years in each field
            </h2>
            <p className="mt-2 text-white/60">
              I started in graphic design and added a new field every few years.
              I still work in all of them.
            </p>
          </Reveal>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {PRACTICE_SINCE.map((item, i) => {
              const years = yearsSince(item.since, now);
              return (
                <Reveal key={item.field} delay={i * 0.05}>
                  <li className="h-full rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10">
                    <p className="flex items-baseline gap-2">
                      <span className="font-[family-name:var(--font-display)] text-5xl">
                        {years}
                      </span>
                      <span className="text-sm text-white/55">
                        year{years === 1 ? "" : "s"}
                      </span>
                    </p>
                    <p className="mt-4 font-medium">{item.field}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">
                      Since {item.since}
                    </p>
                  </li>
                </Reveal>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="border-t border-mist bg-foam py-16">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <Reveal className="max-w-2xl">
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-navy">
              What I can do
            </h2>
            <p className="mt-2 text-navy/55">
              Services I deliver for brands, startups, and teams that need
              design and build in the same conversation.
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
                  <div
                    className="prose prose-sm mt-2 max-w-none leading-relaxed text-navy/65"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeRichText(service.description),
                    }}
                  />
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
              <p className="mt-2 text-navy/55">
                Where I have worked, newest first.
              </p>
            </Reveal>
            <div className="mt-8 space-y-8">
              {experience.map((item, index) => (
                <Reveal
                  key={`${experienceTitle(item)}-${index}`}
                  delay={index * 0.04}
                >
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
                      <p className="mt-1 text-sm font-medium text-navy/60">
                        {item.company}
                      </p>
                    ) : null}
                    {item.description ? (
                      <div
                        className="prose prose-sm mt-3 max-w-none leading-relaxed text-navy/65"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeRichText(item.description),
                        }}
                      />
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
                Education & certificates
              </h2>
              <p className="mt-2 text-navy/55">
                Courses and training, newest first.
              </p>
            </Reveal>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {certifications.map((item, index) => (
                <Reveal key={`${item.name}-${index}`} delay={index * 0.04}>
                  <li className="flex h-full flex-col rounded-2xl bg-foam p-5 ring-1 ring-mist">
                    {item.year ? (
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-navy/45">
                        {item.year}
                      </p>
                    ) : null}
                    <p className="mt-2 font-[family-name:var(--font-display)] text-lg leading-snug text-navy">
                      {item.name}
                    </p>
                    {item.issuer ? (
                      <p className="mt-2 text-sm text-navy/60">{item.issuer}</p>
                    ) : null}
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="border-t border-mist bg-foam py-16">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <Reveal>
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-navy">
              Languages
            </h2>
          </Reveal>
          <ul className="mt-6 flex flex-wrap gap-4">
            {LANGUAGES.map((language) => (
              <li
                key={language.name}
                className="rounded-2xl bg-white px-5 py-4 ring-1 ring-mist"
              >
                <p className="font-medium text-navy">{language.name}</p>
                <p className="mt-0.5 text-sm text-navy/55">{language.level}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

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
            {instagram ? (
              <a
                href={instagram.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-navy/15 px-6 py-3 text-sm font-semibold text-navy"
              >
                Instagram
              </a>
            ) : null}
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
