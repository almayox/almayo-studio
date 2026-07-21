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

export const CATALOG_ICON_OPTIONS: { name: string; Icon: LucideIcon }[] = [
  { name: "Palette", Icon: Palette },
  { name: "Brush", Icon: Brush },
  { name: "PenTool", Icon: PenTool },
  { name: "Layers", Icon: Layers },
  { name: "Layout", Icon: Layout },
  { name: "Monitor", Icon: Monitor },
  { name: "Smartphone", Icon: Smartphone },
  { name: "Code", Icon: Code },
  { name: "Globe", Icon: Globe },
  { name: "Camera", Icon: Camera },
  { name: "Video", Icon: Video },
  { name: "Film", Icon: Film },
  { name: "Clapperboard", Icon: Clapperboard },
  { name: "Box", Icon: Box },
  { name: "Cuboid", Icon: Cuboid },
  { name: "Megaphone", Icon: Megaphone },
  { name: "Sparkles", Icon: Sparkles },
  { name: "Image", Icon: Image },
  { name: "Type", Icon: Type },
  { name: "Folder", Icon: Folder },
];

const iconByName = Object.fromEntries(
  CATALOG_ICON_OPTIONS.map((item) => [item.name, item.Icon]),
) as Record<string, LucideIcon>;

export function isCatalogIconUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("/")
  );
}

export function resolveCatalogIcon(name: string | null | undefined): LucideIcon {
  if (!name || isCatalogIconUrl(name)) return Folder;
  return iconByName[name] ?? Folder;
}
