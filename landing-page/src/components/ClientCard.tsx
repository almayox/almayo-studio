import Link from "next/link";
import { RemoteImage } from "@/components/RemoteImage";
import type { Client } from "@/lib/types";

type Props = {
  client: Client;
  className?: string;
  /** A small centred tile, for showing many brands side by side. */
  compact?: boolean;
};

export function ClientCard({ client, className = "", compact = false }: Props) {
  return (
    <Link
      href={`/clients/${client.slug}`}
      className={`group flex h-full flex-col rounded-2xl border border-mist bg-white transition hover:-translate-y-0.5 hover:border-navy/20 hover:shadow-[0_18px_36px_-28px_rgba(10,31,68,0.5)] ${
        compact ? "items-center p-4 text-center" : "p-6"
      } ${className}`}
    >
      <div className={compact ? "mb-3 flex h-14 items-center" : "mb-5 flex h-16 items-center"}>
        {client.logo_url ? (
          <RemoteImage
            src={client.logo_url}
            alt={client.name}
            className="max-h-12 w-auto object-contain opacity-80 transition group-hover:opacity-100"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy/5 font-[family-name:var(--font-display)] text-lg text-navy">
            {client.name.slice(0, 1)}
          </div>
        )}
      </div>
      <h2
        className={`font-[family-name:var(--font-display)] text-navy ${compact ? "text-base" : "text-xl"}`}
      >
        {client.name}
      </h2>
      {client.work_types ? (
        <p
          className={
            compact ? "mt-1 line-clamp-2 text-xs text-navy/55" : "mt-2 line-clamp-3 text-sm text-navy/60"
          }
        >
          {client.work_types}
        </p>
      ) : null}
    </Link>
  );
}
