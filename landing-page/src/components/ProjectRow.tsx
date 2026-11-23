"use client";

import Link from "next/link";
import { Children, useEffect, useRef, useState } from "react";

/**
 * One category of work as a single row that slides sideways. The row always
 * ends on a quarter of the next card, so it is clear there is more to see:
 * 1¼ cards on a phone, 2¼ on a tablet, 3¼ on a desktop.
 */
export function ProjectRow({
  title,
  href,
  children,
}: {
  title: string;
  /** Where "See all" leads. */
  href?: string;
  children: React.ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoOn, setCanGoOn] = useState(false);

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const update = () => {
      setCanGoBack(element.scrollLeft > 4);
      setCanGoOn(element.scrollLeft + element.clientWidth < element.scrollWidth - 4);
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  // Dragging with the mouse, for desktops: a touch screen or trackpad already
  // slides the row by itself.
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0 || !track.current) return;
    drag.current = { x: event.clientX, left: track.current.scrollLeft, moved: false };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    const element = track.current;
    if (!state || !element) return;
    const distance = event.clientX - state.x;
    if (!state.moved && Math.abs(distance) < 6) return;
    if (!state.moved) {
      state.moved = true;
      setDragging(true);
      element.setPointerCapture(event.pointerId);
    }
    element.scrollLeft = state.left - distance;
  }

  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state) return;
    if (state.moved) {
      track.current?.releasePointerCapture(event.pointerId);
      setDragging(false);
      // Keep the record until the click that follows a drag has been ignored.
      setTimeout(() => (drag.current = null), 0);
    } else {
      drag.current = null;
    }
  }

  /** Moves by the cards that are fully in view, so the peeking card comes first. */
  function slide(direction: 1 | -1) {
    const element = track.current;
    if (!element) return;
    const card = element.firstElementChild as HTMLElement | null;
    const step = card ? card.offsetWidth + 20 : element.clientWidth;
    const cards = Math.max(1, Math.floor(element.clientWidth / step));
    element.scrollBy({ left: direction * cards * step, behavior: "smooth" });
  }

  const arrow =
    "absolute top-[38%] z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-lg text-navy shadow-lg ring-1 ring-mist transition hover:bg-navy hover:text-white md:flex";

  return (
    <section className="mt-12 first:mt-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-navy">{title}</h2>
        {href ? (
          <Link href={href} className="shrink-0 text-sm font-medium text-navy/55 hover:text-navy">
            See all →
          </Link>
        ) : null}
      </div>

      <div className="relative mt-4">
        {canGoBack ? (
          <button type="button" aria-label={`Earlier in ${title}`} onClick={() => slide(-1)} className={`${arrow} -left-4`}>
            ←
          </button>
        ) : null}
        {canGoOn ? (
          <button type="button" aria-label={`More in ${title}`} onClick={() => slide(1)} className={`${arrow} -right-4`}>
            →
          </button>
        ) : null}

        {/* The padding leaves room for a card's hover lift and shadow, which a scrolling box would cut off. */}
        <div
          ref={track}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          // Letting go after a drag must not open the card under the pointer.
          onClickCapture={(event) => {
            if (drag.current?.moved) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          // Otherwise the browser starts dragging the picture or link itself.
          onDragStart={(event) => event.preventDefault()}
          // Snapping is paused while dragging, so the row follows the pointer.
          className={`-mx-1 flex scroll-px-1 gap-5 overflow-x-auto px-1 pb-8 pt-2 [scrollbar-width:none] md:cursor-grab [&::-webkit-scrollbar]:hidden ${
            dragging ? "cursor-grabbing select-none md:cursor-grabbing" : "snap-x snap-mandatory"
          }`}
        >
          {Children.map(children, (child) => (
            <div className="w-[calc((100%-1.25rem)/1.25)] shrink-0 snap-start sm:w-[calc((100%-2.5rem)/2.25)] lg:w-[calc((100%-3.75rem)/3.25)]">
              {child}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
