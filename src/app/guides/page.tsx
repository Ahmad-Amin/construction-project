import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";
import { GUIDES, REGION_LABEL, type GuideRegion } from "@/lib/guides";
import { absoluteUrl, breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { PRODUCT_NAME } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Guides for builders and contractors",
  description:
    "Free, practical guides and templates for builders, contractors and renovators: payment schedules, keeping clients updated, and avoiding disputes.",
  path: "/guides",
});

// The worldwide guides first, then each country's.
const SECTIONS: { region: GuideRegion; title: string; intro: string }[] = [
  { region: "global", title: "For builders everywhere", intro: "Written for any country, with examples in US dollars." },
  { region: "pk", title: "For Pakistan", intro: "With examples in rupees, and the stages and words used on Pakistani sites." },
];

const structured = jsonLd({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      name: `${PRODUCT_NAME} guides`,
      url: absoluteUrl("/guides"),
      hasPart: GUIDES.map((g) => ({ "@type": "Article", headline: g.title, url: absoluteUrl(g.path) })),
    },
    breadcrumbs([
      { name: "Home", path: "/" },
      { name: "Guides", path: "/guides" },
    ]),
  ],
});

export default function GuidesPage() {
  return (
    <div className="flex min-h-full flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structured }} />
      <PublicHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-data-accent">Guides</p>
        <h1 className="mt-2 text-balance text-4xl font-bold tracking-tight sm:text-5xl">Guides for builders and contractors</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Practical advice and free templates for running a building job and keeping your client in the picture. No
          account needed.
        </p>

        {SECTIONS.map((section) => {
          const guides = GUIDES.filter((g) => g.region === section.region);
          if (guides.length === 0) return null;
          return (
            <section key={section.region} className="mt-12" aria-labelledby={`guides-${section.region}`}>
              <h2 id={`guides-${section.region}`} className="text-xl font-bold tracking-tight sm:text-2xl">
                {section.title}
              </h2>
              <p className="mt-1 text-muted">{section.intro}</p>
              <ul className="mt-5 space-y-4">
                {guides.map((g) => (
                  <li key={g.path}>
                    <Link
                      href={g.path}
                      hrefLang={g.region === "pk" ? "en-PK" : "en"}
                      className="group block rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-primary sm:p-6"
                    >
                      <span className="text-xs font-semibold uppercase tracking-wide text-data-accent">
                        Free template · {REGION_LABEL[g.region]}
                      </span>
                      <span className="mt-2 block text-lg font-semibold tracking-tight">{g.title}</span>
                      <span className="mt-1.5 block leading-relaxed text-muted">{g.description}</span>
                      <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold">
                        Read the guide
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </main>

      <PublicFooter />
    </div>
  );
}
