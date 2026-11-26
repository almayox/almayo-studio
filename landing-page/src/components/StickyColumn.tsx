"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Space kept under the fixed navigation bar, and under the column. */
const TOP = 112;
const GAP = 24;

/**
 * A column that stays in view on wide screens while the one beside it scrolls.
 * When it is taller than the window it first scrolls to its end, then stays,
 * so none of it is ever out of reach.
 */
export function StickyColumn({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(TOP);

  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    const update = () =>
      setTop(Math.min(TOP, window.innerHeight - element.offsetHeight - GAP));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div ref={holder} className={`lg:sticky ${className}`} style={{ top }}>
      {children}
    </div>
  );
}
