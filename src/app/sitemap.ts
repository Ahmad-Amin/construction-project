import type { MetadataRoute } from "next";

// The public pages, for search engines. Needs SITE_URL; without it (local development) it is empty.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.SITE_URL?.trim().replace(/\/+$/, "");
  if (!base) return [];
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/trust`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/signup`, changeFrequency: "yearly", priority: 0.5 },
  ];
}
