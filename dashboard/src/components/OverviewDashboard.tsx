import Link from "next/link";
import { PageHeader } from "@/components/ui/PageChrome";

export type OverviewStats = {
  projects: { total: number; visible: number; featured: number };
  catalogs: { total: number; visible: number };
  clients: { total: number; visible: number };
  leads: { total: number; new: number; won: number; lost: number };
  invoices: { count: number; total: number; paid: number };
  expenses: { count: number; byCurrency: Record<string, number> };
  contracts: number;
  campaigns: number;
};

function fmtMoney(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function Stat({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  tone?: "blue" | "green" | "yellow" | "purple" | "red" | "slate";
}) {
  const tones = {
    blue: "border-blue-100 bg-blue-50 text-blue-800",
    green: "border-emerald-100 bg-emerald-50 text-emerald-800",
    yellow: "border-amber-100 bg-amber-50 text-amber-800",
    purple: "border-violet-100 bg-violet-50 text-violet-800",
    red: "border-red-100 bg-red-50 text-red-800",
    slate: "border-mist bg-foam/60 text-navy",
  };
  return (
    <div className={`rounded-xl border px-3 py-3 ${tones[tone]}`}>
      <p className="text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium opacity-80">{label}</p>
    </div>
  );
}

function Section({
  title,
  href,
  description,
  children,
}: {
  title: string;
  href: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-mist bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg text-navy">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-navy/50">{description}</p>
        </div>
        <Link
          href={href}
          className="shrink-0 rounded-lg border border-mist px-3 py-1.5 text-xs font-medium text-navy/70 transition hover:bg-foam hover:text-navy"
        >
          Open →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{children}</div>
    </section>
  );
}

export function OverviewDashboard({ stats }: { stats: OverviewStats }) {
  const outstanding = Math.max(0, stats.invoices.total - stats.invoices.paid);
  const expenseEntries = Object.entries(stats.expenses.byCurrency);

  return (
    <div>
      <PageHeader title="Overview" description="Studio at a glance." />

      <div className="space-y-4 sm:space-y-5">
        <Section
          title="Portfolio"
          href="/projects"
          description="Projects and work categories on the public site."
        >
          <Stat label="Projects" value={stats.projects.total} tone="blue" />
          <Stat label="Published" value={stats.projects.visible} tone="green" />
          <Stat label="Featured" value={stats.projects.featured} tone="purple" />
          <Stat label="Catalogs" value={stats.catalogs.total} tone="slate" />
        </Section>

        <Section
          title="CRM"
          href="/leads"
          description="Clients and inbound leads."
        >
          <Stat label="Clients" value={stats.clients.total} tone="blue" />
          <Stat label="Visible clients" value={stats.clients.visible} tone="green" />
          <Stat label="Leads" value={stats.leads.total} tone="yellow" />
          <Stat label="New / Won" value={`${stats.leads.new} / ${stats.leads.won}`} tone="slate" />
        </Section>

        <Section
          title="Billing"
          href="/invoices"
          description="Invoices and collected amounts."
        >
          <Stat label="Invoices" value={stats.invoices.count} tone="blue" />
          <Stat label="Invoiced" value={fmtMoney(stats.invoices.total)} tone="slate" />
          <Stat label="Collected" value={fmtMoney(stats.invoices.paid)} tone="green" />
          <Stat
            label="Outstanding"
            value={fmtMoney(outstanding)}
            tone={outstanding > 0 ? "yellow" : "green"}
          />
        </Section>

        <Section
          title="Expenses"
          href="/expenses"
          description="Business spending by currency."
        >
          <Stat label="Entries" value={stats.expenses.count} tone="red" />
          {expenseEntries.length === 0 ? (
            <Stat label="Total" value="0" tone="slate" />
          ) : (
            expenseEntries.slice(0, 3).map(([cur, amt]) => (
              <Stat
                key={cur}
                label={`Total ${cur}`}
                value={fmtMoney(amt)}
                tone="slate"
              />
            ))
          )}
        </Section>

        <Section
          title="Delivery"
          href="/contracts"
          description="Contracts and campaign review packs."
        >
          <Stat label="Contracts" value={stats.contracts} tone="purple" />
          <Stat label="Campaigns" value={stats.campaigns} tone="blue" />
          <Stat label="Leads lost" value={stats.leads.lost} tone="red" />
          <Stat
            label="Catalogs live"
            value={stats.catalogs.visible}
            tone="green"
          />
        </Section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy/45">
            Quick links
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { href: "/projects", label: "Projects" },
              { href: "/catalogs", label: "Catalogs" },
              { href: "/clients", label: "Clients" },
              { href: "/leads", label: "Leads" },
              { href: "/invoices", label: "Invoices" },
              { href: "/expenses", label: "Expenses" },
              { href: "/contracts", label: "Contracts" },
              { href: "/campaigns", label: "Campaigns" },
              { href: "/settings", label: "Settings" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl border border-mist bg-white px-3 py-3 text-sm font-medium text-navy transition hover:border-navy/20 hover:bg-foam/50"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
