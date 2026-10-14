import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";
import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/site";

// The shared frame for the Terms of use and the Privacy policy: a readable column, numbered-free
// plain sections, and the same header and footer as the other public pages.
export function LegalPage({
  kicker,
  title,
  intro,
  children,
}: {
  kicker: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-data-accent">{kicker}</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-muted">Last updated {LEGAL_UPDATED}</p>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">{intro}</p>
        {children}
        <p className="mt-14 text-sm text-muted">
          {CONTACT_EMAIL ? (
            <>
              Questions about this page? Write to{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-foreground underline underline-offset-4">
                {CONTACT_EMAIL}
              </a>
              .{" "}
            </>
          ) : null}
          See also{" "}
          <Link href="/trust" className="font-semibold text-foreground underline underline-offset-4">
            Private by design
          </Link>
          .
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}

export function LegalSection({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-24">
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}
