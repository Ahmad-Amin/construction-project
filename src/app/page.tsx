import Link from "next/link";
import { ArrowRight, Banknote, Camera, CheckCircle2, Clock, Eye, EyeOff, HardHat, TrendingUp } from "lucide-react";
import { BackToTop } from "@/components/back-to-top";
import { DemoButtons } from "@/components/demo-buttons";
import { LandingVisual } from "@/components/landing-visual";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";
import { SectionNav } from "@/components/section-nav";
import { SiteIllustration } from "@/components/site-illustration";
import { PRODUCT_NAME } from "@/lib/site";
import { button } from "@/lib/ui";

export const metadata = {
  title: { absolute: `${PRODUCT_NAME}: show your clients how the work is going` },
};

const wrap = "mx-auto w-full max-w-[96rem] px-5 sm:px-8 lg:px-12 2xl:px-16";

// A day with the portal, told plainly.
const day = [
  {
    when: "On site",
    body: "Take a photo, write a line, tick off the stage. It takes a minute, and you do it from your phone.",
  },
  {
    when: "At your client's home",
    body: "They open their own link and see the progress, the photos and what has been paid. Nobody has to phone you.",
  },
  {
    when: "At the end of the month",
    body: "Every payment is confirmed by both of you, so there is one record that nobody has to argue about.",
  },
];

const questions = [
  {
    q: "Does my client need to install anything?",
    a: "No. They open a link on their phone, choose a password, and that's it.",
  },
  {
    q: "Can my client see what I spend?",
    a: "Only what you choose to share. New expenses start hidden, and the totals your client sees never include them.",
  },
  {
    q: "Is it only for big projects?",
    a: "No. A house, an extra floor, a renovation, a shop fit-out. If you have a client who keeps asking for updates, it fits.",
  },
  {
    q: "What if my client disagrees with a payment?",
    a: "They can dispute it and say why. You both see the result, and nothing counts towards the total until it's sorted.",
  },
];

const anchors = [
  { href: "#day", label: "How it works" },
  { href: "#inside", label: "What's inside" },
  { href: "#privacy", label: "Privacy" },
  { href: "#questions", label: "Questions" },
];

// Public landing page. Anything behind login lives under /dashboard.
export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <PublicHeader wide>
        <SectionNav items={anchors} />
      </PublicHeader>

      <main className="flex-1">
        {/* Hero */}
        <section className={`${wrap} grid items-center gap-14 pb-20 pt-10 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28 lg:pt-20`}>
          <div>
            <p className="animate-rise flex items-center gap-3 text-[0.95rem]">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-data-accent ring-1 ring-primary/25">
                <HardHat className="size-[18px]" aria-hidden />
              </span>
              <span>
                <span className="text-muted">Made for </span>
                <span className="font-semibold">home builders and renovators</span>
              </span>
            </p>
            <h1 className="animate-rise mt-6 text-balance text-5xl font-semibold leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl 2xl:text-[5.25rem]" style={{ animationDelay: "60ms" }}>
              Your client keeps asking how it&apos;s going.{" "}
              <span className="text-muted">Now they can just look.</span>
            </h1>
            <p className="animate-rise mt-7 max-w-xl text-lg leading-relaxed text-muted sm:text-xl" style={{ animationDelay: "120ms" }}>
              One private page for each project: photos from the site, what has been paid, and what comes next.
              You post from your phone. They look whenever they like.
            </p>
            <div className="animate-rise mt-9 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ animationDelay: "180ms" }}>
              <Link href="/signup" className={button("primary")}>
                Create your account
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="/login" className="px-2 py-3 text-base font-medium text-muted underline-offset-4 hover:text-foreground hover:underline">
                Homeowner? Sign in
              </Link>
            </div>
            <ul className="animate-rise mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted" style={{ animationDelay: "240ms" }}>
              {["Works on any phone", "Nothing to install", "Set up in a few minutes"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-success" aria-hidden /> {t}
                </li>
              ))}
            </ul>
            <div className="animate-rise mt-9 border-t border-line pt-6" style={{ animationDelay: "300ms" }}>
              <DemoButtons />
            </div>
          </div>

          <LandingVisual />
        </section>

        {/* A normal day */}
        <section id="day" className="scroll-mt-20 border-t border-line">
          <div className={`${wrap} grid gap-10 py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-16 lg:py-28`}>
            <div className="lg:sticky lg:top-28 lg:self-start">
              <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">A normal day with it</h2>
              <p className="mt-4 max-w-sm text-lg leading-relaxed text-muted">
                Three small moments, and nobody has to chase anybody.
              </p>
            </div>
            <ol className="divide-y divide-line border-y border-line">
              {day.map(({ when, body }, i) => (
                <li key={when} className="grid gap-3 py-8 sm:grid-cols-[4rem_1fr] sm:gap-6">
                  <span className="font-mono text-sm text-muted">0{i + 1}</span>
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight">{when}</h3>
                    <p className="mt-2 max-w-xl text-lg leading-relaxed text-muted">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* What's inside */}
        <section id="inside" className="scroll-mt-20 bg-surface-2/60">
          <div className={`${wrap} py-20 lg:py-28`}>
            <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              Everything they ask about, in one place
            </h2>
            <div className="mt-12 grid gap-5 lg:grid-cols-6">
              {/* Progress */}
              <div className="rounded-3xl border border-line bg-surface p-7 lg:col-span-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-data-accent">
                  <TrendingUp className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">Progress, stage by stage</h3>
                <p className="mt-2 text-muted">Stages with percentages, so it&apos;s clear what&apos;s done and what&apos;s next.</p>
                <ul className="mt-6 space-y-4" aria-label="Sample stages">
                  {[
                    ["Foundation", 100],
                    ["Grey structure", 85],
                    ["Electrical", 40],
                  ].map(([name, pct]) => (
                    <li key={name}>
                      <div className="mb-1.5 flex justify-between text-sm">
                        <span>{name}</span>
                        <span className="text-muted tabular-nums">{pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Payments */}
              <div className="rounded-3xl border border-line bg-surface p-7 lg:col-span-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-data-accent">
                  <Banknote className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">Payments you both agree on</h3>
                <p className="mt-2 text-muted">Whoever records a payment, the other side confirms it. Only confirmed ones count.</p>
                <ul className="mt-6 space-y-3" aria-label="Sample payments">
                  <li className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
                    <span>
                      <span className="block text-sm font-medium">PKR 4,000,000</span>
                      <span className="block text-xs text-muted">Bank transfer</span>
                    </span>
                    <span className="flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
                      <CheckCircle2 className="size-3.5" aria-hidden /> Confirmed
                    </span>
                  </li>
                  <li className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
                    <span>
                      <span className="block text-sm font-medium">PKR 1,500,000</span>
                      <span className="block text-xs text-muted">Cheque</span>
                    </span>
                    <span className="flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-data-accent">
                      <Clock className="size-3.5" aria-hidden /> Waiting
                    </span>
                  </li>
                </ul>
              </div>

              {/* Photos */}
              <div className="rounded-3xl border border-line bg-surface p-7 lg:col-span-4">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-data-accent">
                  <Camera className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">Photos as the work happens</h3>
                <p className="mt-2 max-w-md text-muted">
                  Post an update from the site. Your client sees it the same day, with a note on what changed.
                </p>
                <div className="mt-6 grid grid-cols-3 gap-3" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="bg-hero aspect-[4/3] overflow-hidden rounded-2xl border border-line shadow-sm shadow-black/5">
                      <SiteIllustration className={`size-full object-cover ${i === 1 ? "scale-150 origin-bottom-left" : i === 2 ? "scale-125 origin-bottom-right" : ""}`} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Private costs */}
              <div className="rounded-3xl border border-line bg-surface p-7 lg:col-span-2">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-data-accent">
                  <EyeOff className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">Your costs stay private</h3>
                <p className="mt-2 text-muted">
                  Expenses are hidden from your client until you choose to share them.
                </p>
                <ul className="mt-6 space-y-2.5 text-sm" aria-label="Sample expenses">
                  <li className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5">
                    <span>Site office</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted"><EyeOff className="size-3.5" aria-hidden /> Hidden</span>
                  </li>
                  <li className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5">
                    <span>Steel, Ittefaq</span>
                    <span className="flex items-center gap-1.5 text-xs text-success"><Eye className="size-3.5" aria-hidden /> Shared</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section id="privacy" className={`${wrap} scroll-mt-20 py-20 lg:py-28`}>
          <div className="privacy-band rounded-[2rem] px-7 py-12 sm:px-12 sm:py-16 lg:px-16">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
              <div>
                <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">Your numbers stay yours</h2>
                <Link
                  href="/trust"
                  className="mt-8 inline-flex items-center gap-1.5 font-medium underline underline-offset-4 opacity-90 hover:opacity-100"
                >
                  How we look after your data <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
              <ul className="space-y-6 text-lg leading-relaxed">
                {[
                  "Your client sees progress, photos and payments. They don't see your costs until you decide to share them, receipt and all.",
                  "Every company's projects are kept apart by the database itself, not just hidden on screen.",
                  "Download everything as a spreadsheet whenever you like. We don't sell your data.",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3.5">
                    <CheckCircle2 className="mt-1 size-5 shrink-0 text-data-accent" aria-hidden />
                    <span className="opacity-80">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Questions */}
        <section id="questions" className="scroll-mt-20 border-t border-line">
          <div className={`${wrap} py-20 lg:py-28`}>
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">Questions you might have</h2>
            <dl className="mt-12 grid gap-x-16 gap-y-10 md:grid-cols-2">
              {questions.map(({ q, a }) => (
                <div key={q}>
                  <dt className="text-lg font-semibold tracking-tight">{q}</dt>
                  <dd className="mt-2 max-w-lg leading-relaxed text-muted">{a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Closing */}
        <section className={`${wrap} pb-24`}>
          <div className="flex flex-col items-start justify-between gap-8 border-t border-line pt-14 md:flex-row md:items-end">
            <div>
              <h2 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">Try it on your next project.</h2>
              <p className="mt-4 max-w-md text-lg text-muted">Set up your company and your first project in a few minutes.</p>
            </div>
            <Link href="/signup" className={`${button("primary")} shrink-0`}>
              Create your account
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter wide />
      <BackToTop />
    </div>
  );
}
