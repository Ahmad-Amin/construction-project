import Link from "next/link";
import { AlertCircle, Banknote, Camera, CheckCircle2, ChevronRight, EyeOff, Receipt } from "lucide-react";
import { SiteIllustration } from "@/components/site-illustration";
import type { ActivityItem, AttentionItem, FreshPhoto } from "@/lib/dashboard";
import { formatPKR, timeAgo } from "@/lib/format";

// ---------------------------------------------------------------------------
// Greeting: the warm opening of the page, with a little life in it.
// ---------------------------------------------------------------------------
export function GreetingHero({
  greeting,
  dateText,
  summary,
  action,
}: {
  greeting: string;
  dateText: string;
  summary: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="bg-hero animate-rise relative overflow-hidden rounded-3xl border border-line px-6 py-7 sm:px-8 sm:py-9">
      <SiteIllustration className="pointer-events-none absolute -bottom-6 right-0 hidden w-80 opacity-90 sm:block" />
      <div className="relative max-w-xl">
        <p className="text-sm font-medium text-muted">{dateText}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{greeting}</h1>
        <p className="mt-2 text-muted">{summary}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Needs attention: the things that are waiting on this person.
// ---------------------------------------------------------------------------
export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <section className="animate-rise flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
        <span className="flex size-10 items-center justify-center rounded-xl bg-success-soft text-success">
          <CheckCircle2 className="size-5" aria-hidden />
        </span>
        <div>
          <p className="font-semibold">All caught up</p>
          <p className="text-sm text-muted">Nothing is waiting on you right now.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="animate-rise rounded-2xl border border-line bg-surface p-2" aria-label="Needs your attention">
      <h2 className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">
        Needs your attention
      </h2>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-surface-2"
            >
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                  item.tone === "warn" ? "bg-primary-soft text-data-accent" : "bg-surface-2 text-muted"
                }`}
              >
                {item.tone === "warn" ? (
                  <Banknote className="size-[18px]" aria-hidden />
                ) : (
                  <AlertCircle className="size-[18px]" aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{item.text}</span>
                <span className="block truncate text-xs text-muted">{item.projectName}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Fresh from site: the newest photos across projects.
// ---------------------------------------------------------------------------
export function FreshPhotos({ photos }: { photos: FreshPhoto[] }) {
  if (photos.length === 0) return null;

  return (
    <section aria-label="Fresh from site">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <Camera className="size-4 text-data-accent" aria-hidden /> Fresh from site
      </h2>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {photos.map((p, i) => (
          <li key={p.id} className="animate-rise snap-start" style={{ animationDelay: `${i * 60}ms` }}>
            <Link
              href={`/dashboard/projects/${p.projectId}/updates`}
              className="group relative block h-32 w-44 overflow-hidden rounded-xl bg-surface-2 sm:h-36 sm:w-52"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- signed, expiring URL */}
              <img
                src={p.url}
                alt={`Recent photo from ${p.projectName}`}
                loading="lazy"
                className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span className="absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-xs font-medium text-white">
                {p.projectName}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Recent activity across every project.
// ---------------------------------------------------------------------------
const kindIcon = { update: Camera, payment: Banknote, expense: Receipt } as const;

function describe(item: ActivityItem) {
  const who = item.actor || "Someone";
  if (item.kind === "update") return `${who} posted a site update`;
  if (item.kind === "payment") {
    return item.status === "confirmed"
      ? `${who} recorded a payment (confirmed)`
      : item.status === "disputed"
        ? `${who} recorded a payment (disputed)`
        : `${who} recorded a payment`;
  }
  return `${who} added an expense`;
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return null;

  return (
    <section aria-label="Recent activity">
      <h2 className="mb-3 font-semibold">Recent activity</h2>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {items.map((item, i) => {
          const Icon = kindIcon[item.kind];
          return (
            <li key={item.id} className="animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
              <Link
                href={`/dashboard/projects/${item.projectId}/${item.kind === "update" ? "updates" : item.kind === "payment" ? "payments" : "expenses"}`}
                className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2"
              >
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-data-accent">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{describe(item)}</span>
                  <span className="mt-0.5 block line-clamp-1 text-sm text-muted">{item.title}</span>
                  <span className="mt-1 flex items-center gap-2 text-xs text-muted">
                    <span className="truncate">{item.projectName}</span>
                    <span aria-hidden>·</span>
                    <span className="shrink-0">{timeAgo(item.at)}</span>
                    {item.hidden && (
                      <span className="flex shrink-0 items-center gap-1">
                        <EyeOff className="size-3" aria-hidden /> hidden from client
                      </span>
                    )}
                  </span>
                </span>
                {item.amount !== undefined && (
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatPKR(item.amount)}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
