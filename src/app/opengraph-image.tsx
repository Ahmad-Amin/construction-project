import { ImageResponse } from "next/og";
import { PRODUCT_NAME } from "@/lib/site";

// The picture shown when a link to the site is shared (WhatsApp, Facebook, LinkedIn, X...).
// Drawn here in code, so changing the product name or wording changes the picture too.
export const alt = `${PRODUCT_NAME}: show your clients how the work is going`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #fff6df 0%, #fde4b0 100%)",
          color: "#1c1917",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: "#f59e0b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" />
              <path d="M14 6a6 6 0 0 1 6 6v3" />
              <path d="M4 15v-3a6 6 0 0 1 6-6" />
              <rect x="2" y="15" width="20" height="4" rx="1" />
            </svg>
          </div>
          <div style={{ fontSize: 36, fontWeight: 700 }}>{PRODUCT_NAME}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>
            Show your clients how the work is going.
          </div>
          <div style={{ fontSize: 34, lineHeight: 1.35, color: "#57534e", maxWidth: 900 }}>
            Photos from site, progress and payments, on one private page for every project.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, fontSize: 26, fontWeight: 600, color: "#44403c" }}>
          <div style={{ display: "flex", padding: "10px 22px", borderRadius: 999, background: "rgba(255,255,255,0.7)" }}>
            For home builders
          </div>
          <div style={{ display: "flex", padding: "10px 22px", borderRadius: 999, background: "rgba(255,255,255,0.7)" }}>
            Nothing for your client to install
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
