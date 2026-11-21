"use client";

import {
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

export type BookPage = { url: string; width: number; height: number };

/** What is open at once: two facing pages on a wide screen, otherwise one. */
type View = { left: BookPage | null; right: BookPage | null };
/** `dir` is reading order: 1 is the next page, -1 the one before. */
type Turn = { to: number; dir: 1 | -1 };
/**
 * spread: two upright pages around a spine. single: one upright page (phones).
 * calendar: a wide page hinged at the top, lifted up like a desk calendar.
 */
type Mode = "spread" | "single" | "calendar";

const WIDE_QUERY = "(min-width: 768px)";

function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function buildViews(pages: BookPage[], mode: Mode, rtl: boolean): View[] {
  if (mode !== "spread") return pages.map((page) => ({ left: null, right: page }));
  // Like a real book: the cover sits alone, then facing pairs. An Arabic book
  // is the mirror image: cover on the left, each pair read right page first.
  const side = (first: BookPage | null, second: BookPage | null): View =>
    rtl ? { left: second, right: first } : { left: first, right: second };
  const views: View[] = [side(null, pages[0])];
  for (let i = 1; i < pages.length; i += 2) views.push(side(pages[i], pages[i + 1] ?? null));
  return views;
}

function Face({
  page,
  side,
  alt,
}: {
  page: BookPage | null;
  /** Which side of the spine the page is on; "none" when there is no spine. */
  side: "left" | "right" | "none";
  alt: string;
}) {
  if (!page) return null;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={page.url}
        alt={alt}
        draggable={false}
        className="h-full w-full select-none bg-white object-contain"
      />
      {/* Soft shadow toward the spine. */}
      {side === "none" ? null : (
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 w-10 ${
            side === "left"
              ? "right-0 bg-gradient-to-l from-black/15 to-transparent"
              : "left-0 bg-gradient-to-r from-black/15 to-transparent"
          }`}
        />
      )}
    </>
  );
}

function Chevron({ direction }: { direction: "left" | "right" | "up" }) {
  const path =
    direction === "left" ? "M15 5l-7 7 7 7" : direction === "right" ? "M9 5l7 7-7 7" : "M5 15l7-7 7 7";
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
      <path d={path} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A PDF shown as a book. Upright pages turn around a spine on their long side,
 * from the right for English and from the left for Arabic. Wide pages are
 * hinged at the top and lift up like a desk calendar. Pages turn by swiping,
 * tapping a side, the arrow buttons or the keyboard arrows.
 */
export function ProjectBook({
  pages,
  title,
  rtl = false,
}: {
  pages: BookPage[];
  title: string;
  /** Written right to left (Arabic): the book opens the other way. */
  rtl?: boolean;
}) {
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
  const ratio = pages[0].width / pages[0].height;
  const mode: Mode = ratio >= 1.1 ? "calendar" : wide && pages.length > 2 ? "spread" : "single";
  const views = buildViews(pages, mode, rtl);
  /** Turns an on-screen direction (1 = toward the left edge, as in English) into reading order. */
  const sign = rtl ? -1 : 1;

  // The position is kept as a page, so it survives switching between one and two pages.
  const [pageIndex, setPageIndex] = useState(0);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [used, setUsed] = useState(false);
  /** Where a press started, to tell a swipe from a tap. */
  const press = useRef<{ x: number; y: number } | null>(null);

  const page = pages[pageIndex];
  const at = Math.max(
    0,
    views.findIndex((view) => view.left === page || view.right === page),
  );
  const current = views[at];
  const target = turn ? views[turn.to] : null;
  const firstOf = (view: View) =>
    Math.min(...[view.left, view.right].filter(Boolean).map((item) => pages.indexOf(item as BookPage)));

  const canGo = (dir: 1 | -1) => at + dir >= 0 && at + dir < views.length;

  function go(dir: 1 | -1) {
    if (turn || !canGo(dir)) return;
    setUsed(true);
    setTurn({ to: at + dir, dir });
  }
  /** `visual` 1 is what the right-hand arrow does on screen. */
  const goVisual = (visual: 1 | -1) => go((visual * sign) as 1 | -1);

  function finishTurn() {
    if (!turn) return;
    setPageIndex(firstOf(views[turn.to]));
    setTurn(null);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = press.current;
    press.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    // A wide page lifts up: swipe up for the next one, down to go back.
    if (mode === "calendar" && Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx)) {
      return go(dy < 0 ? 1 : -1);
    }
    if (Math.abs(dx) > 40) return goVisual(dx < 0 ? 1 : -1);
    if (Math.abs(dy) > 12) return;
    // A tap: the right side of the book acts like the right arrow, the left like the left.
    const box = event.currentTarget.getBoundingClientRect();
    goVisual(event.clientX - box.left > box.width / 2 ? 1 : -1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") goVisual(1);
    else if (event.key === "ArrowLeft") goVisual(-1);
    else if (mode === "calendar" && event.key === "ArrowDown") go(1);
    else if (mode === "calendar" && event.key === "ArrowUp") go(-1);
    else return;
    event.preventDefault();
  }

  const spread = mode === "spread";
  /** On-screen direction of the turn in progress: 1 = the leaf travels right to left. */
  const visual = turn ? turn.dir * sign : 0;
  // Under the turning leaf: what is already visible on each side.
  const baseLeft = spread && visual === -1 ? target?.left : current.left;
  const baseRight = spread
    ? visual === 1
      ? target?.right
      : current.right
    : turn?.dir === 1
      ? target?.right
      : current.right;

  const first = firstOf(current) + 1;
  const label =
    current.left && current.right
      ? `Pages ${first}–${first + 1} of ${pages.length}`
      : `Page ${first} of ${pages.length}`;
  const nearby = [views[at - 1], views[at + 1]]
    .flatMap((view) => (view ? [view.left, view.right] : []))
    .filter(Boolean) as BookPage[];

  const aspect = spread ? ratio * 2 : ratio;
  const arrowClass =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-navy shadow-sm ring-1 ring-mist transition hover:bg-navy hover:text-white disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-navy";
  const arrow = (visualDir: 1 | -1, className: string) => {
    const dir = (visualDir * sign) as 1 | -1;
    return (
      <button
        type="button"
        onClick={() => go(dir)}
        disabled={!canGo(dir)}
        aria-label={dir === 1 ? "Next page" : "Previous page"}
        className={`${className} ${arrowClass}`}
      >
        <Chevron direction={visualDir === 1 ? "right" : "left"} />
      </button>
    );
  };

  // Which way the hint arrow drifts: the way a finger should move.
  const hint =
    mode === "calendar"
      ? { text: "Swipe up to turn the page", icon: "up" as const, x: 0, y: -1 }
      : rtl
        ? { text: "Swipe right to turn the page", icon: "right" as const, x: 1, y: 0 }
        : { text: "Swipe left to turn the page", icon: "left" as const, x: -1, y: 0 };

  const singleAnimation =
    mode === "calendar"
      ? turn?.dir === 1
        ? "origin-top [animation-name:book-calendar-out]"
        : "origin-top [animation-name:book-calendar-in]"
      : rtl
        ? turn?.dir === 1
          ? "origin-right [animation-name:book-single-out-rtl]"
          : "origin-right [animation-name:book-single-in-rtl]"
        : turn?.dir === 1
          ? "origin-left [animation-name:book-single-out]"
          : "origin-left [animation-name:book-single-in]";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-center justify-center gap-3">
        {arrow(-1, "hidden sm:flex")}

        <div style={{ width: `min(100%, calc(72dvh * ${aspect}))` }}>
          {mode === "calendar" ? (
            // The binding a desk calendar's pages hang from.
            <div
              aria-hidden
              className="flex h-4 items-center justify-around rounded-t-lg bg-navy px-6"
            >
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full bg-white/60" />
              ))}
            </div>
          ) : null}
          <div
            role="group"
            aria-roledescription="book"
            aria-label={`${title}, ${label}. Use the arrow keys to turn the page.`}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onPointerDown={(event) => {
              press.current = { x: event.clientX, y: event.clientY };
            }}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              press.current = null;
            }}
            className={`relative w-full cursor-pointer outline-none [perspective:2200px] focus-visible:ring-2 focus-visible:ring-navy/40 ${
              mode === "calendar" ? "touch-none rounded-b-lg" : "touch-pan-y rounded-lg"
            }`}
            style={{ aspectRatio: aspect }}
          >
            {spread ? (
              <div
                className={`absolute inset-y-0 left-0 w-1/2 overflow-hidden rounded-l-lg ${
                  baseLeft ? "shadow-lg shadow-navy/10" : ""
                }`}
              >
                <Face page={baseLeft ?? null} side="left" alt={`${title}, left page`} />
              </div>
            ) : null}
            <div
              className={`absolute inset-y-0 right-0 overflow-hidden ${
                spread
                  ? "w-1/2 rounded-r-lg"
                  : mode === "calendar"
                    ? "w-full rounded-b-lg"
                    : "w-full rounded-lg"
              } ${baseRight ? "shadow-lg shadow-navy/10" : ""}`}
            >
              <Face
                page={baseRight ?? null}
                side={spread ? "right" : "none"}
                alt={`${title}, page ${first}`}
              />
            </div>

            {turn && target ? (
              spread ? (
                // The turning leaf: its front is the page leaving, its back the page arriving.
                <div
                  onAnimationEnd={finishTurn}
                  className={`book-leaf absolute inset-y-0 w-1/2 [transform-style:preserve-3d] ${
                    visual === 1
                      ? "right-0 origin-left [animation-name:book-turn-next]"
                      : "left-0 origin-right [animation-name:book-turn-prev]"
                  }`}
                >
                  <div className="absolute inset-0 overflow-hidden [backface-visibility:hidden]">
                    <Face
                      page={visual === 1 ? current.right : current.left}
                      side={visual === 1 ? "right" : "left"}
                      alt=""
                    />
                  </div>
                  <div className="absolute inset-0 overflow-hidden [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    <Face
                      page={visual === 1 ? target.left : target.right}
                      side={visual === 1 ? "left" : "right"}
                      alt=""
                    />
                  </div>
                </div>
              ) : (
                // One page at a time: the page swings (or lifts) off the stack, or back onto it.
                <div
                  onAnimationEnd={finishTurn}
                  className={`book-leaf absolute inset-0 overflow-hidden ${
                    mode === "calendar" ? "rounded-b-lg" : "rounded-lg"
                  } ${singleAnimation}`}
                >
                  <Face page={turn.dir === 1 ? current.right : target.right} side="none" alt="" />
                </div>
              )
            ) : null}

            {!used && views.length > 1 ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
                <span className="flex items-center gap-2 rounded-full bg-navy/85 px-4 py-2 text-xs font-medium text-white shadow-lg">
                  <span
                    className="book-swipe-hint inline-flex"
                    style={{ "--hx": hint.x, "--hy": hint.y } as CSSProperties}
                  >
                    <Chevron direction={hint.icon} />
                  </span>
                  {hint.text}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {arrow(1, "hidden sm:flex")}
      </div>

      <div className="flex items-center gap-4">
        {arrow(-1, "sm:hidden")}
        <p className="min-w-[9rem] text-center text-sm text-navy/60" aria-live="polite">
          {label}
        </p>
        {arrow(1, "sm:hidden")}
      </div>

      {/* Fetch the neighbouring pages ahead, so a turn never shows a blank page. */}
      <div hidden>
        {nearby.map((item) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={item.url} src={item.url} alt="" />
        ))}
      </div>
    </div>
  );
}
