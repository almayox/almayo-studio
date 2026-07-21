"use client";

import {
  Box,
  Brush,
  Camera,
  Clapperboard,
  Code,
  Cuboid,
  Film,
  Folder,
  Globe,
  Image,
  Layers,
  Layout,
  Megaphone,
  Monitor,
  Palette,
  PenTool,
  Smartphone,
  Sparkles,
  Type,
  Video,
  type LucideIcon,
} from "lucide-react";
import { RemoteImage } from "@/components/RemoteImage";

const iconByName: Record<string, LucideIcon> = {
  Palette,
  Brush,
  PenTool,
  Layers,
  Layout,
  Monitor,
  Smartphone,
  Code,
  Globe,
  Camera,
  Video,
  Film,
  Clapperboard,
  Box,
  Cuboid,
  Megaphone,
  Sparkles,
  Image,
  Type,
  Folder,
};

function isCatalogIconUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("/")
  );
}

type Props = {
  icon: string | null;
  name: string;
  className?: string;
};

export function CatalogIcon({ icon, name, className = "" }: Props) {
  if (isCatalogIconUrl(icon)) {
    return (
      <RemoteImage
        src={icon!}
        alt=""
        className={`h-6 w-6 object-contain ${className}`}
      />
    );
  }

  const Icon = icon ? iconByName[icon] ?? Folder : null;

  if (Icon) {
    return <Icon className={`h-6 w-6 ${className}`} aria-hidden />;
  }

  return (
    <span className={`font-[family-name:var(--font-display)] text-lg ${className}`}>
      {name.slice(0, 1)}
    </span>
  );
}
