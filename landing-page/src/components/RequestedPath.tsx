"use client";

import { usePathname } from "next/navigation";

/** The address the visitor asked for, shortened if it is very long. */
export function RequestedPath({ className }: { className?: string }) {
  const path = usePathname() || "/";
  return (
    <span className={className}>{path.length > 42 ? `${path.slice(0, 41)}…` : path}</span>
  );
}
