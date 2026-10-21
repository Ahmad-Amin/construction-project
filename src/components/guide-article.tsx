import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Globe } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";
import { otherVersion, REGION_LABEL, type Guide } from "@/lib/guides";
import { absoluteUrl, breadcrumbs, faqPage, jsonLd, organization } from "@/lib/seo";
import { PRODUCT_NAME } from "@/lib/site";
import { button } from "@/lib/ui";

// The frame every guide is written in: where it sits (Guides › country), when it was last checked, a link to
// the other country's version, the contents, the questions, and an invitation to try BuildPeek. It also
// writes the structured data search engines read: the article, its breadcrumbs and its questions.

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export type GuideQuestion = { q: string; a: string };

export function GuideArticle({
  guide,
  shortTitle,
  intro,
  minutes,
  contents,
  faqs,
  otherNote,
  children,
}: {
  guide: Guide;
  // For the breadcrumbs: "Payment schedule".
  shortTitle: string;
  intro: string;
  minutes: number;
  contents: { id: string; title: string }[];
  faqs: GuideQuestion[];
  // The line that points to the other country's version, e.g. "Building in Pakistan?".
  otherNote: string;
  children: React.ReactNode;
}) {
  const other = otherVersion(guide);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Guides", path: "/guides" },
    { name: shortTitle, path: guide.path },
  ];
  const structured = jsonLd({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: guide.title,
        description: guide.description,
        datePublished: guide.published,
        dateModified: guide.updated,
        inLanguage: guide.region === "pk" ? "en-PK" : "en",
        url: absoluteUrl(guide.path),
        mainEntityOfPage: absoluteUrl(guide.path),
        image: absoluteUrl(`${guide.path}/opengraph-image`),
        author: { "@id": organization()["@id"] },
        publisher: { "@id": organization()["@id"] },
      },
      organization(),
      breadcrumbs(crumbs),
      faqPage(faqs),
    ],
  });

  return (
    <div className="flex min-h-full flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structured }} />
      <PublicHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-14">
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/guides" className="hover:text-foreground">
                Guides
              </Link>
            </li>
            <li aria-hidden>›</li>
            <li aria-current="page">{guide.region === "global" ? shortTitle : `${shortTitle} · ${REGION_LABEL[guide.region]}`}</li>
          </ol>
        </nav>

        <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl">{guide.title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">{intro}</p>
        <p className="mt-4 text-sm text-muted">
          Updated <time dateTime={guide.updated}>{longDate(guide.updated)}</time> · {minutes} min read
        </p>

        {other && (
          <Link
            href={other.path}
            hrefLang={other.region === "pk" ? "en-PK" : "en"}
            className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-surface-2/60 px-4 py-3 text-sm transition-colors hover:border-primary"
          >
            <Globe className="size-5 shrink-0 text-data-accent" aria-hidden />
            <span>
              <span className="font-semibold">{otherNote}</span>{" "}
              <span className="text-muted">Read the {other.region === "global" ? "worldwide" : REGION_LABEL[other.region]} version.</span>
            </span>
            <ArrowRight className="ml-auto size-4 shrink-0 text-muted" aria-hidden />
          </Link>
        )}

        <nav aria-label="On this page" className="mt-8 rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">On this page</h2>
          <ol className="mt-3 space-y-1.5 text-sm">
            {contents.map((c) => (
              <li key={c.id}>
                <a href={`#${c.id}`} className="text-foreground underline-offset-4 hover:text-data-accent hover:underline">
                  {c.title}
                </a>
              </li>
            ))}
            <li>
              <a href="#questions" className="text-foreground underline-offset-4 hover:text-data-accent hover:underline">
                Questions people ask
              </a>
            </li>
          </ol>
        </nav>

        {children}

        <section id="questions" className="mt-14 scroll-mt-24" aria-labelledby="questions-title">
          <h2 id="questions-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Questions people ask
          </h2>
          <dl className="mt-5 divide-y divide-line rounded-2xl border border-line bg-surface">
            {faqs.map((f) => (
              <div key={f.q} className="px-5 py-4 sm:px-6">
                <dt className="font-semibold">{f.q}</dt>
                <dd className="mt-1.5 leading-relaxed text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-14 rounded-3xl border border-line bg-hero p-6 sm:p-8">
          <h2 className="text-balance text-2xl font-bold tracking-tight">Keep the schedule, and every payment, in one place</h2>
          <p className="mt-3 max-w-xl leading-relaxed text-muted">
            In {PRODUCT_NAME}, each payment falls due when its stage is finished, your client is told, and every payment
            is confirmed by both of you. Free for your first project. Your clients never pay.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/signup" className={button("primary", "lg")}>
              Create your free account <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/pricing" className="px-2 py-3 font-medium text-muted underline-offset-4 hover:text-foreground hover:underline">
              See pricing
            </Link>
          </div>
        </section>

        <p className="mt-10 text-xs leading-relaxed text-muted">
          This guide is general information, not legal or financial advice. Rules on deposits, retention and
          contracts differ from place to place, so check what applies where you build.
        </p>
      </main>

      <PublicFooter />
    </div>
  );
}

// A section of a guide, with its heading, and the spacing and colours the article uses.
export function GuideSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-14 scroll-mt-24">
      <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      <div className="mt-4 space-y-4 text-[1.05rem] leading-relaxed text-muted [&_h3]:pt-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_strong]:font-semibold [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

const cellPad = "px-3 py-2.5 sm:px-4";

// A worked example: each stage, its share and its amount, for a given contract value. Written out in full
// (not in the calculator) so it reads well printed and to search engines. It fits a phone screen: long
// stage names wrap, amounts never do.
export function StageTable({
  caption,
  currency,
  total,
  stages,
}: {
  caption: string;
  currency: string;
  total: number;
  stages: [name: string, percent: number][];
}) {
  const amounts = stages.map(([, p]) => Math.round((total * p) / 100));
  const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="border-b border-line px-3 py-3 text-left font-semibold text-foreground sm:px-4">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <th scope="col" className={`${cellPad} font-semibold`}>Paid when this is complete</th>
            <th scope="col" className={`${cellPad} text-right font-semibold`}>Share</th>
            <th scope="col" className={`${cellPad} text-right font-semibold`}>Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {stages.map(([name, p], i) => (
            <tr key={name}>
              <th scope="row" className={`${cellPad} font-medium text-foreground`}>{name}</th>
              <td className={`${cellPad} text-right tabular-nums`}>{p}%</td>
              <td className={`${cellPad} whitespace-nowrap text-right tabular-nums text-foreground`}>
                {currency} {amounts[i].toLocaleString("en-US")}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-line font-semibold text-foreground">
            <th scope="row" className={cellPad}>Total</th>
            <td className={`${cellPad} text-right tabular-nums`}>{sum(stages.map(([, p]) => p))}%</td>
            <td className={`${cellPad} whitespace-nowrap text-right tabular-nums`}>
              {currency} {sum(amounts).toLocaleString("en-US")}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// Practical advice as a list of short, bold points with a sentence or two each.
export function Tips({ items }: { items: { title: string; body: string }[] }) {
  return (
    <ul className="space-y-4">
      {items.map((t) => (
        <li key={t.title} className="flex items-start gap-3">
          <CheckCircle2 className="mt-1 size-5 shrink-0 text-success" aria-hidden />
          <span>
            <strong>{t.title}</strong> {t.body}
          </span>
        </li>
      ))}
    </ul>
  );
}

// A real screen from the app, in a dark frame like the app's own dark theme. `narrow` is for a tall one (a
// form), so it doesn't fill a whole screen.
export function Screenshot({
  src,
  alt,
  width,
  height,
  caption,
  narrow = false,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption: string;
  narrow?: boolean;
}) {
  return (
    <figure className={narrow ? "mx-auto max-w-sm" : ""}>
      <div className="overflow-hidden rounded-2xl border border-line bg-[#0c0a09] p-2 sm:p-3">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={narrow ? "384px" : "(min-width: 768px) 720px, 100vw"}
          className="h-auto w-full rounded-xl"
        />
      </div>
      <figcaption className="mt-2 text-center text-sm text-muted">{caption}</figcaption>
    </figure>
  );
}
