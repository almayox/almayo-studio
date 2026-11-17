import Link from "next/link";
import {
  CircleAlert,
  Clock,
  FileSignature,
  FileText,
  FolderKanban,
  Inbox,
  Plus,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { OverviewActivity, OverviewData } from "@/lib/overview";

const cardClass = "rounded-2xl border border-line bg-surface";

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    // Unknown currency code: fall back to a plain number with the code.
    return `${Math.round(value).toLocaleString("en")} ${currency}`;
  }
}

function StatTile({
  label,
  value,
  note,
  noteTone = "muted",
  icon: Icon,
  href,
}: {
  label: string;
  value: string | number;
  note: string;
  noteTone?: "muted" | "good" | "bad";
  icon: LucideIcon;
  href: string;
}) {
  const noteClass = {
    muted: "text-fg/50",
    good: "text-emerald-700",
    bad: "text-red-700",
  }[noteTone];
  return (
    <Link href={href} className={`${cardClass} block p-4 transition hover:bg-muted/60 sm:p-5`}>
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">{label}</span>
        <Icon size={15} strokeWidth={1.75} className="text-fg/45" aria-hidden />
      </div>
      <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums tracking-tight text-fg sm:text-[1.75rem]">
        {value}
      </p>
      <p className={`mt-0.5 text-xs ${noteClass}`}>{note}</p>
    </Link>
  );
}

/** Collected per month as a line chart. Server-rendered SVG, no chart library. */
function RevenueChart({
  months,
  currency,
}: {
  months: OverviewData["revenueByMonth"];
  currency: string;
}) {
  const width = 640;
  const height = 200;
  const padX = 8;
  const padTop = 16;
  const padBottom = 28;
  const max = Math.max(...months.map((m) => m.amount));
  const hasData = max > 0;
  const innerH = height - padTop - padBottom;
  const stepX = (width - padX * 2) / (months.length - 1);
  const points = months.map((m, i) => ({
    ...m,
    x: padX + i * stepX,
    y: padTop + innerH - (hasData ? (m.amount / max) * innerH : 0),
  }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1].x.toFixed(1)} ${padTop + innerH} L${points[0].x.toFixed(1)} ${padTop + innerH} Z`;
  const last = points[points.length - 1];
  const summary = months.map((m) => `${m.label} ${money(m.amount, currency)}`).join(", ");

  return (
    <section className={`${cardClass} p-4 sm:p-5`}>
      <div className="flex items-baseline gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-fg">
          Collected
        </h2>
        <span className="eyebrow">Last 12 months · {currency}</span>
      </div>

      {hasData ? (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mt-3 h-auto w-full"
          role="img"
          aria-label={`Payments collected per month: ${summary}`}
        >
          <defs>
            <linearGradient id="revenue-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((i) => {
            const y = padTop + (innerH / 3) * i;
            return (
              <line key={i} x1={padX} x2={width - padX} y1={y} y2={y} stroke="var(--color-line)" strokeWidth="1" />
            );
          })}
          <path d={area} fill="url(#revenue-fill)" />
          <path
            d={line}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((p) => (
            <circle key={p.key} cx={p.x} cy={p.y} r="9" fill="transparent">
              <title>{`${p.label}: ${money(p.amount, currency)}`}</title>
            </circle>
          ))}
          <circle cx={last.x} cy={last.y} r="4.5" fill="var(--color-accent)" stroke="var(--color-canvas)" strokeWidth="2" />
          {points.map((p, i) =>
            i % 2 === 1 ? (
              <text
                key={p.key}
                x={p.x}
                y={height - 6}
                textAnchor="middle"
                className="fill-fg/45 font-mono text-[10px] uppercase tracking-widest"
              >
                {p.label}
              </text>
            ) : null,
          )}
        </svg>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-line px-4 py-12 text-center text-sm text-fg/50">
          No payments recorded in the last 12 months. Payments you record on invoices appear here.
        </p>
      )}
    </section>
  );
}

function ActionItems({ data }: { data: OverviewData }) {
  const items = [
    {
      count: data.overdueInvoices,
      label: data.overdueInvoices === 1 ? "overdue invoice to chase" : "overdue invoices to chase",
      href: "/invoices",
    },
    {
      count: data.newLeads,
      label: data.newLeads === 1 ? "new lead to answer" : "new leads to answer",
      href: "/leads",
    },
    {
      count: data.openQuotations,
      label: data.openQuotations === 1 ? "quotation awaiting a reply" : "quotations awaiting a reply",
      href: "/quotations",
    },
    {
      count: data.contractsAwaitingSignature,
      label:
        data.contractsAwaitingSignature === 1
          ? "contract awaiting signature"
          : "contracts awaiting signature",
      href: "/contracts",
    },
  ].filter((item) => item.count > 0);

  return (
    <section className={`${cardClass} p-4 sm:p-5`}>
      <div className="flex items-center gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-fg">
          Action items
        </h2>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums text-fg/80">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-fg/50">Nothing is waiting on you.</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-fg/85 transition hover:bg-subtle hover:text-fg"
              >
                <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-fg/40" aria-hidden />
                <span className="min-w-0 truncate">
                  <span className="font-semibold tabular-nums">{item.count}</span> {item.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const ACTIVITY_ICONS: Record<OverviewActivity["kind"], LucideIcon> = {
  payment: Wallet,
  lead: Inbox,
  contract: FileSignature,
};

function formatDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en", { day: "numeric", month: "short", timeZone: "UTC" });
}

function RecentActivity({ activity }: { activity: OverviewActivity[] }) {
  return (
    <section className={`${cardClass} p-4 sm:p-5`}>
      <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-fg">
        Recent activity
      </h2>
      {activity.length === 0 ? (
        <p className="mt-4 text-sm text-fg/50">
          Payments, enquiries and signed contracts will show up here.
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {activity.map((item) => {
            const Icon = ACTIVITY_ICONS[item.kind];
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition hover:bg-subtle"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-fg/80">
                    <Icon size={13} strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-fg/90">{item.text}</span>
                  <span className="shrink-0 text-xs tabular-nums text-fg/45">{formatDay(item.date)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const QUICK_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/projects/new", label: "New project", icon: Plus },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/quotations", label: "Quotations", icon: FileText },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/expenses", label: "Expenses", icon: Wallet },
];

function QuickLinks() {
  return (
    <section className={`${cardClass} p-4 sm:p-5`}>
      <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-fg">
        Quick links
      </h2>
      <ul className="mt-3 space-y-1.5">
        {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center justify-center gap-2 rounded-lg bg-subtle px-3 py-2 text-sm font-medium text-fg/85 transition hover:bg-muted hover:text-fg"
            >
              <Icon size={14} strokeWidth={1.75} aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OverviewDashboard({ data }: { data: OverviewData }) {
  const { currency } = data;

  let collectedNote = "No payments last month";
  let collectedTone: "muted" | "good" | "bad" = "muted";
  if (data.collectedLastMonth > 0) {
    const change = Math.round(
      ((data.collectedThisMonth - data.collectedLastMonth) / data.collectedLastMonth) * 100,
    );
    collectedNote = `${change >= 0 ? "+" : ""}${change}% vs last month`;
    collectedTone = change >= 0 ? "good" : "bad";
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            Overview
          </h1>
          <p className="mt-1 text-sm text-fg/55">
            {data.hasOtherCurrencies
              ? `Money figures cover ${currency} invoices only.`
              : "The studio at a glance."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/quotations" className="btn-secondary">
            <FileText size={15} strokeWidth={1.75} aria-hidden />
            Quotations
          </Link>
          <Link href="/invoices" className="btn-primary">
            <Receipt size={15} strokeWidth={2} aria-hidden />
            Invoices
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatTile
          label="Collected"
          value={money(data.collectedThisMonth, currency)}
          note={collectedNote}
          noteTone={collectedTone}
          icon={TrendingUp}
          href="/invoices"
        />
        <StatTile
          label="Outstanding"
          value={money(data.outstanding, currency)}
          note={`${data.unpaidInvoices} unpaid ${data.unpaidInvoices === 1 ? "invoice" : "invoices"}`}
          icon={Clock}
          href="/invoices"
        />
        <StatTile
          label="Overdue"
          value={money(data.overdue, currency)}
          note={`${data.overdueInvoices} ${data.overdueInvoices === 1 ? "invoice" : "invoices"}`}
          noteTone={data.overdueInvoices > 0 ? "bad" : "muted"}
          icon={CircleAlert}
          href="/invoices"
        />
        <StatTile
          label="Clients"
          value={data.clients}
          note="in your client list"
          icon={Users}
          href="/clients"
        />
        <StatTile
          label="Projects"
          value={data.projects}
          note={`${data.publishedProjects} published`}
          icon={FolderKanban}
          href="/projects"
        />
        <StatTile
          label="New leads"
          value={data.newLeads}
          note={data.newLeads > 0 ? "waiting for a reply" : "all answered"}
          noteTone={data.newLeads > 0 ? "good" : "muted"}
          icon={Inbox}
          href="/leads"
        />
      </div>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart months={data.revenueByMonth} currency={currency} />
        </div>
        <ActionItems data={data} />
      </div>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentActivity activity={data.activity} />
        </div>
        <QuickLinks />
      </div>
    </div>
  );
}
