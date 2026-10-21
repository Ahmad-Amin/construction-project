import type { MetadataRoute } from "next";
import { GUIDES, guideVersions } from "@/lib/guides";

// The public pages, for search engines. Needs SITE_URL; without it (local development) it is empty.
// Each guide lists its other country versions too, so search engines treat them as one article in different
// editions rather than as copies.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.SITE_URL?.trim().replace(/\/+$/, "");
  if (!base) return [];
  const url = (path: string) => `${base}${path === "/" ? "" : path}`;
  const newest = GUIDES.map((g) => g.updated).sort().at(-1);
  return [
    { url: url("/"), changeFrequency: "monthly", priority: 1 },
    { url: url("/pricing"), changeFrequency: "monthly", priority: 0.7 },
    { url: url("/guides"), changeFrequency: "weekly", priority: 0.7, ...(newest ? { lastModified: newest } : {}) },
    ...GUIDES.map((g) => {
      const versions = guideVersions(g);
      const languages: Record<string, string> = Object.fromEntries(Object.entries(versions).map(([lang, path]) => [lang, url(path)]));
      if (versions.en) languages["x-default"] = url(versions.en);
      return {
        url: url(g.path),
        lastModified: g.updated,
        changeFrequency: "monthly" as const,
        priority: 0.8,
        alternates: { languages },
      };
    }),
    { url: url("/trust"), changeFrequency: "yearly", priority: 0.6 },
    { url: url("/terms"), changeFrequency: "yearly", priority: 0.3 },
    { url: url("/privacy"), changeFrequency: "yearly", priority: 0.3 },
    { url: url("/signup"), changeFrequency: "yearly", priority: 0.5 },
  ];
}
