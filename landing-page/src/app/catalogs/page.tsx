import type { Metadata } from "next";
import Link from "next/link";
import { CatalogIcon } from "@/components/CatalogIcon";
import { Reveal, RevealItem, RevealStagger } from "@/components/Reveal";
import { getCatalogs, getProjects } from "@/lib/data";

export const metadata: Metadata = {
  title: "Catalogs",
  description: "Browse Almayo Studio work by catalog.",
};

export default async function CatalogsPage() {
  const [catalogs, projects] = await Promise.all([getCatalogs(), getProjects()]);

  const rows = catalogs.map((catalog) => ({
    ...catalog,
    count: projects.filter((p) => p.catalog_id === catalog.id).length,
  }));

  return (
    <>
      <div className="mx-auto max-w-6xl px-5 pb-16 pt-32 sm:px-6">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-navy/45">
            Catalogs
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-navy sm:text-5xl">
            Work by category
          </h1>
          <p className="mt-4 max-w-2xl text-navy/65">
            Explore projects grouped by discipline: brand, product, campaigns, and more.
          </p>
        </Reveal>

        {rows.length ? (
          <RevealStagger className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((catalog) => (
              <RevealItem key={catalog.id}>
                <Link
                  href={`/catalogs/${catalog.slug}`}
                  className="group block h-full rounded-2xl border border-mist bg-white p-6 transition hover:-translate-y-0.5 hover:border-navy/25 hover:shadow-[0_18px_36px_-28px_rgba(10,31,68,0.5)]"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-navy/5 text-navy">
                    <CatalogIcon icon={catalog.icon} name={catalog.name} />
                  </div>
                  <h2 className="font-[family-name:var(--font-display)] text-xl text-navy">
                    {catalog.name}
                  </h2>
                  {catalog.description ? (
                    <p className="mt-2 line-clamp-3 text-sm text-navy/60">
                      {catalog.description}
                    </p>
                  ) : null}
                  <p className="mt-4 text-xs font-medium text-navy/55">
                    {catalog.count} project{catalog.count === 1 ? "" : "s"}
                  </p>
                </Link>
              </RevealItem>
            ))}
          </RevealStagger>
        ) : (
          <p className="mt-12 text-navy/65">
            New work is on its way.{" "}
            <Link href="/contact" className="font-medium text-navy underline underline-offset-4">
              Get in touch
            </Link>{" "}
            to see recent projects.
          </p>
        )}
      </div>
    </>
  );
}
