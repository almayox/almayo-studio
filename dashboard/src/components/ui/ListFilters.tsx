"use client";

import { controlClass, filterLabelClass } from "@/components/ui/PageChrome";

export type FilterOption = { value: string; label: string };

type ListFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  status?: string;
  onStatusChange?: (value: string) => void;
  statusOptions?: FilterOption[];
  statusLabel?: string;
  extra?: React.ReactNode;
};

export function ListFilters({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  status,
  onStatusChange,
  statusOptions,
  statusLabel = "Status",
  extra,
}: ListFiltersProps) {
  return (
    <div className="mb-4 rounded-xl border border-mist bg-white p-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9.5rem] sm:items-end lg:grid-cols-[minmax(0,1fr)_9.5rem_auto]">
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className={filterLabelClass}>Search</span>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={controlClass}
          />
        </label>
        {statusOptions && onStatusChange ? (
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className={filterLabelClass}>{statusLabel}</span>
            <select
              value={status ?? "all"}
              onChange={(e) => onStatusChange(e.target.value)}
              className={controlClass}
            >
              <option value="all">All</option>
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {extra ? <div className="flex items-end sm:col-span-2 lg:col-span-1">{extra}</div> : null}
      </div>
    </div>
  );
}

export function filterBySearch<T>(
  items: T[],
  search: string,
  getText: (item: T) => string,
): T[] {
  const q = search.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => getText(item).toLowerCase().includes(q));
}
