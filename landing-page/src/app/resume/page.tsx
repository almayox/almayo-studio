import type { Metadata } from "next";
import { Reveal } from "@/components/Reveal";
import { getResume, getSiteSettings } from "@/lib/data";

export const metadata: Metadata = {
  title: "Resume",
  description: "Download Alemayehu Ibrahim resume.",
};

export default async function ResumePage() {
  const [resume, settings] = await Promise.all([getResume(), getSiteSettings()]);

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-32 sm:px-6">
      <Reveal>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy/45">
          Resume
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-navy sm:text-5xl">
          Download CV
        </h1>
        <p className="mt-4 text-navy/65">
          Get the latest resume for {settings.site_name}.
        </p>
      </Reveal>

      <Reveal delay={0.08} className="mt-10 rounded-2xl border border-mist bg-white p-8">
        {resume?.file_url ? (
          <>
            <p className="text-sm text-navy/60">
              {resume.original_name || "Resume.pdf"}
            </p>
            <a
              href={resume.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex rounded-xl bg-navy px-6 py-3 text-sm font-semibold text-white"
            >
              Download PDF
            </a>
          </>
        ) : (
          <p className="text-sm text-navy/60">
            Resume not uploaded yet. Add it from the dashboard Settings.
          </p>
        )}
      </Reveal>
    </div>
  );
}
