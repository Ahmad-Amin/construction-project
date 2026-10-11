import type { MetadataRoute } from "next";

// The public pages, for search engines. Needs SITE_URL; without it (local development) it is empty.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.SITE_URL?.trim().replace(/\/+$/, "");
  if (!base) return [];
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/trust`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/signup`, changeFrequency: "yearly", priority: 0.5 },
  ];
}
