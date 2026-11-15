"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { controlClass } from "@/components/ui/PageChrome";

export type SearchSelectOption = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SearchSelectOption[];
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
};

export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = "Search…",
  emptyLabel,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function choose(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`${controlClass} flex items-center justify-between gap-2 text-left`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? "truncate text-navy" : "truncate text-navy/45"}>
          {selected?.label || emptyLabel || placeholder}
        </span>
        <span className="shrink-0 text-navy/40" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-mist bg-white shadow-lg">
          <div className="border-b border-mist p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="control w-full bg-foam"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtered[0]) choose(filtered[0].value);
                }
              }}
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1" role="listbox">
            {emptyLabel ? (
              <li>
                <button
                  type="button"
                  onClick={() => choose("")}
                  className={`flex w-full px-3 py-2 text-left text-sm ${
                    !value ? "bg-foam text-navy" : "text-navy/70 hover:bg-foam"
                  }`}
                >
                  {emptyLabel}
                </button>
              </li>
            ) : null}
            {filtered.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  onClick={() => choose(option.value)}
                  className={`flex w-full px-3 py-2 text-left text-sm ${
                    option.value === value
                      ? "bg-navy text-white"
                      : "text-navy hover:bg-foam"
                  }`}
                >
                  {option.label}
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-navy/50">No matches</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
