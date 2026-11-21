"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ProjectMedia } from "@/lib/types";
import { parseYouTubeLink } from "@/lib/youtube";
import { StorageImage, StorageVideo } from "@/components/StorageMedia";

const tileButtonClass =
  "absolute bottom-1.5 right-1.5 z-10 cursor-pointer rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-black/85";

function SortableMediaItem({
  item,
  onDelete,
  onEditPoster,
  carousel,
  joined,
  onToggleJoin,
  onToggleRtl,
  onCrop,
}: {
  item: ProjectMedia;
  onDelete: () => void;
  /** Opens the thumbnail chooser for a video. */
  onEditPoster: () => void;
  /** "2/3" when the item is part of a carousel post. */
  carousel: string | null;
  /** Whether it can be joined to the item before it; null hides the control. */
  joined: boolean | null;
  onToggleJoin: () => void;
  onToggleRtl: () => void;
  /** Opens the crop chooser; shown when the item has a picture to crop. */
  onCrop: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative aspect-square cursor-grab touch-none active:cursor-grabbing"
      {...attributes}
      {...listeners}
      aria-label="Drag image to reorder"
    >
      {item.media_type === "youtube" ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.poster_url || ""}
            alt=""
            draggable={false}
            className="pointer-events-none h-full w-full rounded-lg bg-subtle object-cover"
          />
          <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
            {parseYouTubeLink(item.url)?.short ? "YouTube Short" : "YouTube"}
          </span>
        </>
      ) : item.media_type === "model" ? (
        <>
          {item.poster_url ? (
            <StorageImage
              src={item.poster_url}
              alt=""
              draggable={false}
              style={{ objectPosition: item.poster_position || undefined }}
              className="pointer-events-none h-full w-full rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-lg bg-subtle text-xs text-fg/50">
              3D model
            </div>
          )}
          <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
            3D model
          </span>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onEditPoster();
            }}
            className={tileButtonClass}
          >
            {item.poster_url ? "Change thumbnail" : "Set thumbnail"}
          </button>
        </>
      ) : item.media_type === "video" ? (
        <>
          {item.poster_url ? (
            <StorageImage
              src={item.poster_url}
              alt=""
              draggable={false}
              style={{ objectPosition: item.poster_position || undefined }}
              className="pointer-events-none h-full w-full rounded-lg object-cover"
            />
          ) : (
            <StorageVideo
              src={item.url}
              muted
              playsInline
              preload="metadata"
              className="pointer-events-none h-full w-full rounded-lg bg-subtle object-cover"
            />
          )}
          <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
            Video
          </span>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onEditPoster();
            }}
            className={tileButtonClass}
          >
            {item.poster_url ? "Change video thumbnail" : "Set video thumbnail"}
          </button>
        </>
      ) : (
        <>
          <StorageImage
            src={item.url}
            alt=""
            draggable={false}
            className="pointer-events-none h-full w-full rounded-lg object-cover"
          />
          {item.media_type === "pdf" ? (
            <>
              <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                PDF · {item.pages?.length ?? 0} pages
              </span>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleRtl();
                }}
                title="Which way the book opens. Press to switch."
                className={tileButtonClass}
              >
                {item.rtl ? "Opens: Arabic (right to left)" : "Opens: English (left to right)"}
              </button>
            </>
          ) : null}
        </>
      )}

      {item.media_type === "image" || (item.media_type !== "pdf" && item.poster_url) ? (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onCrop();
          }}
          title="Choose which part shows when the picture is cropped"
          className={`absolute right-1.5 z-10 cursor-pointer rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-black/85 ${
            item.media_type === "image" ? "bottom-1.5" : "bottom-9"
          }`}
        >
          Crop
        </button>
      ) : null}

      {carousel ? (
        <span className="pointer-events-none absolute right-1.5 top-1.5 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-black">
          Carousel {carousel}
        </span>
      ) : null}
      {joined === null ? null : (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleJoin();
          }}
          className="absolute bottom-1.5 left-1.5 z-10 cursor-pointer rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-black/85"
        >
          {joined ? "Separate" : "Join previous"}
        </button>
      )}

      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-red-600 text-xs text-white opacity-0 transition group-hover:opacity-100"
        aria-label="Remove media"
      >
        ×
      </button>
    </div>
  );
}

/** "2/3" for the second of three items sharing a post, or null when it stands alone. */
function carouselLabel(items: ProjectMedia[], item: ProjectMedia) {
  if (!item.group_key) return null;
  const group = items.filter((entry) => entry.group_key === item.group_key);
  return group.length > 1 ? `${group.indexOf(item) + 1}/${group.length}` : null;
}

export function SortableMediaGrid({
  items,
  onReorder,
  onDelete,
  onEditPoster,
  grouping,
  onToggleJoin,
  onToggleRtl,
  onCrop,
}: {
  items: ProjectMedia[];
  onReorder: (items: ProjectMedia[]) => void;
  onDelete: (id: string) => void;
  onEditPoster: (item: ProjectMedia) => void;
  /** Show the controls that join items into carousel posts. */
  grouping: boolean;
  onToggleJoin: (item: ProjectMedia) => void;
  onToggleRtl: (item: ProjectMedia) => void;
  onCrop: (item: ProjectMedia) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((m) => m.id === active.id);
    const newIndex = items.findIndex((m) => m.id === over.id);
    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  if (!items.length) {
    return (
      <p className="text-sm text-fg/50">No gallery media yet. Drop files below.</p>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((m) => m.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item, index) => (
            <SortableMediaItem
              key={item.id}
              item={item}
              onDelete={() => onDelete(item.id)}
              onEditPoster={() => onEditPoster(item)}
              carousel={grouping ? carouselLabel(items, item) : null}
              joined={
                grouping && index > 0 && item.media_type !== "pdf" && item.media_type !== "model"
                  ? Boolean(item.group_key && item.group_key === items[index - 1].group_key)
                  : null
              }
              onToggleJoin={() => onToggleJoin(item)}
              onToggleRtl={() => onToggleRtl(item)}
              onCrop={() => onCrop(item)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
