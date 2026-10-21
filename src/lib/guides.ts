import type { Versions } from "@/lib/seo";

// The guides: free, practical articles for builders and their clients. Each topic can have a version for
// everyone and a version for one country, with its own examples, money and words (not the same text with
// the currency swapped). The guides page, the sitemap and each article's language links read this list.

export type GuideRegion = "global" | "pk";

export type Guide = {
  topic: string;
  region: GuideRegion;
  path: string;
  // The heading on the page, and a shorter one for the browser tab and search results (which cut off at
  // about 60 characters).
  title: string;
  metaTitle: string;
  description: string;
  // ISO dates. Change `updated` whenever the article changes in a way readers would notice.
  published: string;
  updated: string;
};

export const GUIDES: Guide[] = [
  {
    topic: "payment-schedule",
    region: "global",
    path: "/guides/construction-payment-schedule",
    title: "Construction payment schedule: a free template, with examples",
    metaTitle: "Construction payment schedule: free template and examples",
    description:
      "Plan stage payments for a new home or a renovation: typical percentages, a free payment schedule template and calculator, and how to avoid payment disputes.",
    published: "2026-10-22",
    updated: "2026-10-22",
  },
  {
    topic: "payment-schedule",
    region: "pk",
    path: "/pk/guides/construction-payment-schedule",
    title: "House construction payment schedule in Pakistan: a stage-wise instalment plan",
    metaTitle: "House construction payment schedule in Pakistan (template)",
    description:
      "Plan instalments for a house build in Pakistan: a stage-wise payment plan for grey structure and finishing, a PKR calculator and a free template.",
    published: "2026-10-22",
    updated: "2026-10-22",
  },
];

export const REGION_LABEL: Record<GuideRegion, string> = { global: "Worldwide", pk: "Pakistan" };

const HREFLANG: Record<GuideRegion, keyof Versions> = { global: "en", pk: "en-PK" };

export function guideAt(path: string) {
  const guide = GUIDES.find((g) => g.path === path);
  if (!guide) throw new Error(`No guide at ${path}`);
  return guide;
}

// Every version of a guide's topic, by language tag, for the hreflang links.
export function guideVersions(guide: Guide): Versions {
  return Object.fromEntries(GUIDES.filter((g) => g.topic === guide.topic).map((g) => [HREFLANG[g.region], g.path]));
}

// The same topic for the other region (the "Building in Pakistan?" link), if there is one.
export function otherVersion(guide: Guide) {
  return GUIDES.find((g) => g.topic === guide.topic && g.region !== guide.region) ?? null;
}
