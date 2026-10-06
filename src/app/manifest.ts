import type { MetadataRoute } from "next";

// Lets a phone "Add to Home Screen" and open the portal like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Client Portal",
    short_name: "Client Portal",
    description:
      "Progress, money, receipts and project updates, shared between contractor and homeowner.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#f59e0b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
