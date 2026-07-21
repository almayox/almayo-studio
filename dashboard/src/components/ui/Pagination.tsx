"use client";

import { useMemo, useState } from "react";
import { inlineSelectClass } from "@/components/ui/PageChrome";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export function usePagination<T>(items: T[], defaultSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultSize);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  function changePageSize(next: number) {
    setPageSize(next);
    setPage(1);
  }

  function goTo(next: number) {
    setPage(Math.min(Math.max(1, next), totalPages));
  }

  return {
    page: safePage,
    pageSize,
    total,
    totalPages,
    pageItems,
    changePageSize,
    goTo,
    rangeStart: total === 0 ? 0 : (safePage - 1) * pageSize + 1,
    rangeEnd: Math.min(safePage * pageSize, total),
  };
}

export function PaginationBar({
  page,
  pageSize,
  total,
  totalPages,
  rangeStart,
  rangeEnd,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-mist bg-foam/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-navy/55">
        Showing <span className="font-medium text-navy">{rangeStart}</span>–
        <span className="font-medium text-navy">{rangeEnd}</span> of{" "}
        <span className="font-medium text-navy">{total}</span>
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-navy/60">
          Rows
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className={`${inlineSelectClass} min-w-[4.5rem] bg-white`}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="btn-secondary px-3 text-xs disabled:opacity-40"
          >
            Prev
          </button>
          <span className="min-w-[4.5rem] text-center text-xs font-medium text-navy">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="btn-secondary px-3 text-xs disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
