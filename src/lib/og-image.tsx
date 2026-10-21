import { ImageResponse } from "next/og";
import { REGION_LABEL, type Guide } from "@/lib/guides";
import { PRODUCT_NAME } from "@/lib/site";

// The picture shown when a guide is shared (WhatsApp, LinkedIn, X...): the guide's title on the same warm
// background as the site's own picture (src/app/opengraph-image.tsx).
export const OG_SIZE = { width: 1200, height: 630 };

export function guideImage(guide: Guide) {
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
          <div
            style={{
              display: "flex",
              marginLeft: "auto",
              padding: "10px 22px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.7)",
              fontSize: 26,
              fontWeight: 600,
              color: "#44403c",
            }}
          >
            {guide.region === "global" ? "Free guide" : `Free guide · ${REGION_LABEL[guide.region]}`}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 68, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5, maxWidth: 1050 }}>
          {guide.title}
        </div>

        <div style={{ display: "flex", fontSize: 28, color: "#57534e" }}>buildpeek.app/guides</div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
