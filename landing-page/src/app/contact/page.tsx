import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { Reveal } from "@/components/Reveal";
import { getContactDetails, getSiteSettings } from "@/lib/data";
import { whatsappLink } from "@/lib/content";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Almayo Studio on WhatsApp or send a project inquiry.",
};

export default async function ContactPage() {
  const [contact, settings] = await Promise.all([
    getContactDetails(),
    getSiteSettings(),
  ]);
  const number = contact.whatsapp_number || settings.whatsapp_number;

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-32 sm:px-6">
      <Reveal>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy/45">
          Contact
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-navy sm:text-5xl">
          Let’s build something
        </h1>
        <p className="mt-4 max-w-xl text-navy/65">
          Send a message or reach out on WhatsApp for project inquiries and collaborations.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <Reveal>
          <ContactForm />
        </Reveal>
        <Reveal delay={0.08} className="space-y-8 rounded-2xl border border-mist bg-white p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-navy/45">WhatsApp</p>
            <a
              href={whatsappLink(number)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block font-[family-name:var(--font-display)] text-2xl text-navy hover:underline"
            >
              {number}
            </a>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-navy/45">Email</p>
            <a href={`mailto:${contact.email}`} className="mt-2 block text-lg text-navy/80">
              {contact.email}
            </a>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-navy/45">Location</p>
            <p className="mt-2 text-lg text-navy/80">{contact.location}</p>
          </div>
          <a
            href={whatsappLink(number)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-xl bg-[#25D366] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-95"
          >
            Open WhatsApp
          </a>
        </Reveal>
      </div>
    </div>
  );
}
