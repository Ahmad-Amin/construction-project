import type { Metadata } from "next";
import { CONTACT_EMAIL, PRODUCT_NAME } from "@/lib/site";

// What search engines and link previews read about each public page, in one place.

// The site's address, without a trailing slash. SITE_URL in production; localhost while developing.
export function siteUrl() {
  return (process.env.SITE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}

export function absoluteUrl(path: string) {
  return `${siteUrl()}${path === "/" ? "" : path}`;
}

export const SITE_DESCRIPTION = "Progress, money, receipts and project updates, shared between contractor and homeowner.";

// The same page written for different countries ("en" is the one for everyone, "en-PK" for Pakistan). Each
// version lists all of them, so search engines show people the one for where they are.
export type Versions = Partial<Record<"en" | "en-PK", string>>;

// A page's title, description and address, and the matching link-preview tags. A page that sets its own
// openGraph replaces the whole one from the layout, picture included, so every page goes through here to keep
// the site name, description, type and picture in every preview.
export function pageMetadata({
  title,
  absoluteTitle = false,
  description,
  path,
  versions,
  locale = "en_US",
  type = "website",
  published,
  modified,
  ownImage = false,
}: {
  title: string;
  // True for a title that already says BuildPeek (otherwise " · BuildPeek" is added).
  absoluteTitle?: boolean;
  description: string;
  path: string;
  versions?: Versions;
  // Open Graph locale: en_US for the worldwide pages, en_PK for the Pakistan ones.
  locale?: string;
  type?: "website" | "article";
  published?: string;
  modified?: string;
  // True when the page has its own opengraph-image and twitter-image files (the guides); otherwise the
  // site's picture (src/app/opengraph-image.tsx) is used.
  ownImage?: boolean;
}): Metadata {
  const shownTitle = absoluteTitle ? title : `${title} · ${PRODUCT_NAME}`;
  const languages = versions
    ? { ...versions, ...(versions.en ? { "x-default": versions.en } : {}) }
    : undefined;
  const siteImage = { width: 1200, height: 630, alt: `${PRODUCT_NAME}: show your clients how the work is going` };
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path, ...(languages ? { languages } : {}) },
    openGraph: {
      siteName: PRODUCT_NAME,
      title: shownTitle,
      description,
      url: path,
      locale,
      ...(ownImage ? {} : { images: [{ url: "/opengraph-image", type: "image/png", ...siteImage }] }),
      ...(type === "article"
        ? { type: "article", publishedTime: published, modifiedTime: modified }
        : { type: "website" }),
    },
    twitter: {
      card: "summary_large_image",
      title: shownTitle,
      description,
      ...(ownImage ? {} : { images: [{ url: "/twitter-image", ...siteImage }] }),
    },
  };
}

// Structured data as the text of a <script type="application/ld+json">. The "<" is escaped so nothing in
// it can close the script tag.
export function jsonLd(data: object) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function organization() {
  return {
    "@type": "Organization",
    "@id": `${siteUrl()}/#organization`,
    name: PRODUCT_NAME,
    url: siteUrl(),
    logo: absoluteUrl("/brand/buildpeek-mark.png"),
    ...(CONTACT_EMAIL ? { email: CONTACT_EMAIL } : {}),
  };
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqPage(items: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
}
