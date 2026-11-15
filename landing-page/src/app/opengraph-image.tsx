import { ImageResponse } from "next/og";

export const alt = "Almayo Studio: Graphic Design & Software Engineering";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
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
