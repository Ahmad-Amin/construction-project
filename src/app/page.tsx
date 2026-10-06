import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Camera,
  History,
  TrendingUp,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { DemoButtons } from "@/components/demo-buttons";
import { ProjectPreview } from "@/components/project-preview";
import { button } from "@/lib/ui";

const features = [
  {
    icon: TrendingUp,
    title: "Clear progress",
    body: "Milestones with percentages, so homeowners see what's done and what's next.",
  },
  {
    icon: Banknote,
    title: "Money in, money out",
    body: "Payments received and expenses recorded, with the receipt for each one.",
  },
  {
    icon: Camera,
    title: "Site updates",
    body: "Photos and notes posted straight from a phone, as the work happens.",
  },
  {
    icon: History,
    title: "One timeline",
    body: "Every update, expense and payment in a single history. No more digging through WhatsApp.",
  },
];

const steps = [
  {
    title: "Create the project",
    body: "Add the client, the location and a few milestones. It takes about a minute.",
  },
  {
    title: "Post from the site",
    body: "Your team adds updates, expenses and payments from their phones.",
  },
  {
    title: "Your client stays informed",
    body: "They sign in and see progress, money and photos, without calling you.",
  },
];

// Public landing page. Anything behind login lives under /dashboard.
export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-line/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <Logo />
          <nav className="flex items-center gap-1">
            <span className="hidden sm:block">
              <a href="#how-it-works" className={button("ghost", "sm")}>
                How it works
              </a>
            </span>
            <Link href="/login" className={button("ghost", "sm")}>
              Sign in
            </Link>
            <Link href="/signup" className={button("primary", "sm")}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="bg-blueprint absolute inset-0 -z-10" aria-hidden />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-14 sm:py-20 lg:grid-cols-2">
            <div>
              <p className="mb-4 inline-flex rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted">
                Built for residential contractors
              </p>
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                Show your clients exactly where their project stands.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted">
                A professional portal for contractors and homeowners. Progress,
                payments, receipts and site updates, all in one place.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/signup" className={button("primary")}>
                  Create contractor account
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link href="/login" className={button("secondary")}>
                  Homeowner sign in
                </Link>
              </div>
              <p className="mt-4 text-sm text-muted">
                Works on any phone. No app to install.
              </p>
              <div className="mt-8">
                <DemoButtons />
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <ProjectPreview />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16">
          <h2 className="max-w-xl text-2xl font-bold tracking-tight sm:text-3xl">
            Everything a homeowner asks about, answered before they call.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-line bg-surface p-5">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="border-y border-line bg-surface-2/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2>
            <ol className="mt-8 grid gap-8 sm:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title}>
                  <span className="flex size-9 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16">
          <div className="rounded-3xl bg-foreground px-6 py-12 text-center text-background sm:px-12">
            <h2 className="mx-auto max-w-xl text-2xl font-bold tracking-tight sm:text-3xl">
              Put your next project on the portal.
            </h2>
            <p className="mx-auto mt-3 max-w-md opacity-70">
              Set up your company and your first project in minutes.
            </p>
            <Link href="/signup" className={`${button("primary")} mt-7`}>
              Get started
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        © {new Date().getFullYear()} Client Portal
      </footer>
    </div>
  );
}
