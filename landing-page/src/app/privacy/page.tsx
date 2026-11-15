import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { getContactDetails } from "@/lib/data";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How Almayo Studio collects, uses and stores personal information from enquiries and client projects.",
};

const LAST_UPDATED = "15 November 2026";

export default async function PrivacyPage() {
  const contact = await getContactDetails();
  const email = contact.email?.trim();

  const emailLink = email ? (
    <a href={`mailto:${email}`} className="font-medium text-navy underline underline-offset-4">
      {email}
    </a>
  ) : (
    <Link href="/contact" className="font-medium text-navy underline underline-offset-4">
      the contact page
    </Link>
  );

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-32 sm:px-6">
      <Reveal>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy/45">
          Privacy
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-navy sm:text-5xl">
          Privacy policy
        </h1>
        <p className="mt-4 text-navy/65">
          Almayo Studio is a one-person design and software studio based in Kuwait, working
          with clients internationally. This page explains in plain language what I collect,
          why, and what you can ask me to do with it.
        </p>
        <p className="mt-3 text-sm text-navy/50">Last updated: {LAST_UPDATED}</p>
      </Reveal>

      <div className="mt-12 space-y-10 text-base leading-relaxed text-navy/70">
        <section>
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-navy">
            What I collect
          </h2>
          <p className="mt-3">
            When you send a message through the contact form, I receive the details you
            enter: your name, email address, phone number, the service you are interested in,
            and your message.
          </p>
          <p className="mt-3">
            If you are a client and I send you a private link to review work or sign a
            contract, the site records your name, IP address and device details at the moment
            you approve the work or sign. This is kept as an audit trail so that both of us
            have a reliable record of what was agreed and when.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-navy">
            Why I collect it
          </h2>
          <p className="mt-3">
            I use this information to reply to enquiries and to manage the projects I take
            on. I do not sell it, and I do not use it for advertising.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-navy">
            Where it is stored
          </h2>
          <p className="mt-3">
            Enquiries and project records are stored in a database hosted by Supabase, and
            this website is hosted by Vercel. Both act as service providers for the studio,
            and their servers may be located outside your country.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-navy">
            Tracking
          </h2>
          <p className="mt-3">This site does not use advertising trackers.</p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-navy">
            How long I keep it
          </h2>
          <p className="mt-3">
            I keep enquiries for as long as they are relevant to our conversation or to a
            project, and I delete them when you ask me to.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-navy">
            Your rights
          </h2>
          <p className="mt-3">
            You can ask me for a copy of the information I hold about you, ask me to correct
            it, or ask me to delete it. To do any of these, {email ? "email me at" : "reach me through"}{" "}
            {emailLink}.
          </p>
        </section>
      </div>
    </div>
  );
}
