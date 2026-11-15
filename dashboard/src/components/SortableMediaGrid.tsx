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
import { StorageImage, StorageVideo } from "@/components/StorageMedia";

function SortableMediaItem({
  item,
  isThumb,
  onDelete,
  onSetThumbnail,
}: {
  item: ProjectMedia;
  isThumb: boolean;
  onDelete: () => void;
  onSetThumbnail: () => void;
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
      {item.media_type === "video" ? (
        <StorageVideo
          src={item.url}
          preload="none"
          className="pointer-events-none h-full w-full rounded-lg bg-foam object-cover"
        />
      ) : (
        <StorageImage
          src={item.url}
          alt=""
          draggable={false}
          className="pointer-events-none h-full w-full rounded-lg object-cover"
        />
      )}

      {isThumb ? (
        <div
          className="absolute bottom-1.5 left-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 shadow-sm"
          title="Current thumbnail"
        >
          ★
        </div>
      ) : (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onSetThumbnail();
          }}
          title="Use as thumbnail"
          className="absolute bottom-1.5 left-1.5 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-black/50 text-xs text-white opacity-0 transition group-hover:opacity-100 hover:bg-amber-400"
        >
          ★
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

export function SortableMediaGrid({
  items,
  thumbnailUrl,
  onReorder,
  onDelete,
  onSetThumbnail,
}: {
  items: ProjectMedia[];
  thumbnailUrl: string;
  onReorder: (items: ProjectMedia[]) => void;
  onDelete: (id: string) => void;
  onSetThumbnail: (url: string) => void;
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
      <p className="text-sm text-navy/50">No gallery media yet. Drop files below.</p>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((m) => m.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item) => (
            <SortableMediaItem
              key={item.id}
              item={item}
              isThumb={thumbnailUrl === item.url}
              onDelete={() => onDelete(item.id)}
              onSetThumbnail={() => onSetThumbnail(item.url)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
