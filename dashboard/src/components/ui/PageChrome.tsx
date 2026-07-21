export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-navy sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-navy/55">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-mist bg-white px-4 py-14 text-center text-sm text-navy/55">
      {message}
    </div>
  );
}

export function SummaryCards({
  items,
}: {
  items: { label: string; value: string | number; tone?: SummaryTone }[];
}) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:mb-6 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-xl border p-4 ${toneClass(item.tone || "blue")}`}
        >
          <div className="text-2xl font-bold tabular-nums">{item.value}</div>
          <div className="mt-1 text-xs font-medium opacity-80">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

type SummaryTone = "blue" | "green" | "yellow" | "purple" | "red" | "slate";

function toneClass(tone: SummaryTone) {
  switch (tone) {
    case "green":
      return "border-emerald-100 bg-emerald-50 text-emerald-800";
    case "yellow":
      return "border-amber-100 bg-amber-50 text-amber-800";
    case "purple":
      return "border-violet-100 bg-violet-50 text-violet-800";
    case "red":
      return "border-red-100 bg-red-50 text-red-800";
    case "slate":
      return "border-mist bg-white text-navy";
    default:
      return "border-blue-100 bg-blue-50 text-blue-800";
  }
}

/** Shared single-line control (42px) — see globals.css `.control` */
export const controlClass = "control w-full";

export const fieldClass = controlClass;

export const inlineSelectClass = "control w-auto min-w-[9rem] bg-foam";

export const controlRowClass = "flex flex-wrap items-center gap-2";

export const labelClass = "flex flex-col gap-1.5 text-xs font-medium text-navy/65";

export const filterLabelClass = "mb-0 block text-xs font-medium text-navy/60";

export const primaryBtnClass = "btn-primary";

export const secondaryBtnClass = "btn-secondary";

export const dangerLinkClass =
  "text-sm font-medium text-red-700 hover:text-red-800 hover:underline";

export const softLinkClass =
  "text-sm font-medium text-navy/80 hover:text-navy hover:underline";

export {
  ActionButton,
  ActionGroup,
  actionBtnClass,
  actionBtnDangerClass,
} from "@/components/ui/ActionButton";


