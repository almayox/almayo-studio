import type { Metadata } from "next";
import Link from "next/link";
import { ClientCard } from "@/components/ClientCard";
import { Reveal } from "@/components/Reveal";
import { getClients } from "@/lib/data";

export const metadata: Metadata = {
  title: "Clients",
  description: "Brands and clients Almayo Studio has worked with.",
};

export default async function ClientsPage() {
  const clients = await getClients();

  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-32 sm:px-6">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy/45">
            Clients
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-navy sm:text-5xl">
            Brands I’ve worked with
          </h1>
          <p className="mt-4 max-w-2xl text-navy/65">
            A selection of companies and studios I’ve partnered with on design and product work.
          </p>
        </Reveal>

        {clients.length ? (
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((client, i) => (
              <Reveal key={client.id} delay={i * 0.04}>
                <ClientCard client={client} />
              </Reveal>
            ))}
          </div>
        ) : (
          <p className="mt-12 text-navy/65">
            I’m putting together a selection of client work to share here.{" "}
            <Link href="/contact" className="font-medium text-navy underline underline-offset-4">
              Get in touch
            </Link>{" "}
            to hear who I’ve worked with.
          </p>
        )}
      </div>
  );
}
