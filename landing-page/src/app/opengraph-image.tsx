import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getSiteSettings } from "@/lib/data";
import { signStorageUrl } from "@/lib/storage";

export const alt = "Almayo Studio: Graphic Design & Software Engineering";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The drawn card, used until a share image is uploaded in the dashboard. */
function drawnCard() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a1f44",
          color: "#ffffff",
          padding: 80,
        }}
      >
        <div
          style={{
            width: 88,
            height: 88,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#ffffff",
            color: "#0a1f44",
            borderRadius: 20,
            fontSize: 60,
            fontWeight: 700,
          }}
        >
          A
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 112, fontWeight: 700, letterSpacing: -3 }}>
            Almayo Studio
          </div>
          <div style={{ marginTop: 16, fontSize: 42, color: "rgba(255,255,255,0.75)" }}>
            Graphic Design &amp; Software Engineering
          </div>
        </div>
        <div style={{ fontSize: 28, color: "rgba(255,255,255,0.55)" }}>almayostudio.com</div>
      </div>
    ),
    size,
  );
}

/** The share image uploaded in the dashboard (Settings, Brand), as a PNG of the standard size. */
async function uploadedPicture() {
  const settings = await getSiteSettings();
  const url = await signStorageUrl(settings.og_image_url, 60);
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) return null;
  return sharp(Buffer.from(await response.arrayBuffer()))
    .rotate()
    .resize(size.width, size.height, { fit: "cover", position: "attention" })
    .png()
    .toBuffer();
}

/**
 * The picture shown when a link to the site is shared and the page has none of
 * its own: the uploaded share image, or the drawn card when there is none.
 */
export default async function OpenGraphImage(): Promise<Response> {
  const picture = await uploadedPicture().catch(() => null);
  if (!picture) return drawnCard();
  return new Response(new Uint8Array(picture), {
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=3600" },
  });
}
