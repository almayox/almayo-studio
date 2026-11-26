import sharp from "sharp";
import StudioImage from "@/app/opengraph-image";
import { getProjectBySlug } from "@/lib/data";

export const alt = "Project by Almayo Studio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/jpeg";

async function projectPicture(slug: string) {
  const { project } = await getProjectBySlug(slug);
  const url = project?.thumbnail_url;
  if (!url || !url.startsWith("http")) return null;
  const response = await fetch(url);
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

async function toJpeg(source: Buffer) {
  return sharp(source)
    .rotate()
    .resize(size.width, size.height, { fit: "cover", position: "attention" })
    .jpeg({ quality: 80 })
    .toBuffer();
}

/**
 * The picture chat apps show next to a shared project link: the project's own
 * card picture, or the site's share image when the project has none.
 */
export default async function ProjectLinkImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const fallback = async () => Buffer.from(await (await StudioImage()).arrayBuffer());
  const picture = (await projectPicture(slug).catch(() => null)) ?? (await fallback());
  // A card picture that cannot be read as an image falls back to the site's own.
  const jpeg = await toJpeg(picture).catch(async () => toJpeg(await fallback()));
  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=3600" },
  });
}
