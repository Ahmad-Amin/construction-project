import type { MetadataRoute } from "next";

// What search engines may visit. The public pages are open; everything behind sign-in, the
// personal invite links and the technical routes are not.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.SITE_URL?.trim().replace(/\/+$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/invite/", "/api/", "/auth/", "/demo", "/forgot-password"] }],
    ...(base ? { sitemap: `${base}/sitemap.xml`, host: base } : {}),
  };
}
