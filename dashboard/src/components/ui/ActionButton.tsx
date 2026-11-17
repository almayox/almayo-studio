"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

const actionBtnClass =
  "inline-flex h-[var(--control-h)] w-[var(--control-h)] shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-fg transition hover:border-fg/25 hover:bg-subtle disabled:opacity-40";

const actionBtnDangerClass =
  "inline-flex h-[var(--control-h)] w-[var(--control-h)] shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 disabled:opacity-40";

export function ActionGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-1">{children}</div>;
}

export function ActionButton({
  icon: Icon,
  label,
  onClick,
  href,
  danger,
  disabled,
  title,
  showLabel = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
  showLabel?: boolean;
}) {
  const className = danger ? actionBtnDangerClass : actionBtnClass;
  const tooltip = title || label;
  const content = showLabel ? (
    <>
      <Icon size={15} strokeWidth={2} aria-hidden />
      <span className="text-[10px] font-semibold leading-tight">{label}</span>
    </>
  ) : (
    <Icon size={16} strokeWidth={2} aria-hidden />
  );

  const labeledClass = showLabel
    ? `${className} h-auto min-h-[var(--control-h)] w-auto min-w-[var(--control-h)] flex-col gap-0.5 px-2 py-1.5`
    : className;

  if (href) {
    return (
      <Link
        href={href}
        className={labeledClass}
        title={tooltip}
        aria-label={label}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={labeledClass}
      title={tooltip}
      aria-label={label}
    >
      {content}
    </button>
  );
}
