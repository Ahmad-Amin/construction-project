import Link from "next/link";
import { Building2, ChevronRight, Clock, MapPin, User } from "lucide-react";
import { StatusBadge } from "@/components/project-bits";
import { ProgressRing } from "@/components/viz";
import { SiteIllustration } from "@/components/site-illustration";
import { formatPKRCompact, formatRelativeDate } from "@/lib/format";
import type { DashboardProject } from "@/lib/dashboard";

// A project as a card: the latest site photo as its cover, progress as a ring,
// and the money picture in one line.
export function ProjectCard({
  project: p,
  perspective,
  index = 0,
}: {
  project: DashboardProject;
  // Who is looking: wording changes ("received" vs "paid").
  perspective: "company" | "client";
  index?: number;
}) {
  const moneyLabel = perspective === "company" ? "received" : "paid";
  const receivedPct = p.budget ? Math.min(100, Math.round((p.received / p.budget) * 100)) : null;

  return (
    <Link
      href={`/dashboard/projects/${p.id}`}
      className={`group animate-rise block overflow-hidden rounded-2xl border border-line bg-surface transition duration-300 hover:-translate-y-1 hover:border-primary/60 hover:shadow-xl hover:shadow-black/10 ${p.archived ? "opacity-75" : ""}`}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="bg-hero relative h-40 overflow-hidden">
        {p.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed, expiring URL
          <img
            src={p.coverUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <SiteIllustration className="size-full object-cover p-3" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/45 to-transparent" aria-hidden />

        <StatusBadge status={p.status} archived={p.archived} className="absolute left-3 top-3 shadow-sm ring-1 ring-black/5" />
        {p.awaitingMe > 0 && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow">
            <Clock className="size-3" aria-hidden /> {p.awaitingMe} to confirm
          </span>
        )}
        <div className="absolute bottom-3 right-3 rounded-full bg-surface/95 p-1 shadow-lg">
          <ProgressRing percent={p.progress} size={54} stroke={6}>
            <span className="text-[13px] font-bold tabular-nums">{p.progress}%</span>
          </ProgressRing>
        </div>
      </div>

      <div className="p-5">
        <h2 className="text-lg font-bold leading-tight">{p.name}</h2>
        <div className="mt-1.5 space-y-0.5 text-sm text-muted">
          {p.location && (
            <p className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" aria-hidden /> {p.location}
            </p>
          )}
          {perspective === "company" && p.clientName && (
            <p className="flex items-center gap-1.5">
              <User className="size-3.5 shrink-0" aria-hidden /> {p.clientName}
            </p>
          )}
          {perspective === "client" && p.companyName && (
            <p className="flex items-center gap-1.5">
              <Building2 className="size-3.5 shrink-0" aria-hidden /> {p.companyName}
            </p>
          )}
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between text-xs">
            <span className="font-semibold">
              {formatPKRCompact(p.received)} <span className="font-normal text-muted">{moneyLabel}</span>
            </span>
            {p.budget ? (
              <span className="text-muted">of {formatPKRCompact(p.budget)}</span>
            ) : null}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="animate-grow h-full rounded-full bg-data-accent"
              style={{ width: `${receivedPct ?? 0}%`, animationDelay: `${300 + index * 70}ms` }}
            />
          </div>
        </div>

        <p className="mt-4 line-clamp-2 min-h-10 text-sm text-muted">
          {p.lastUpdate ? (
            <>
              <span className="font-medium text-foreground">{formatRelativeDate(p.lastUpdate.date)}:</span>{" "}
              {p.lastUpdate.text}
            </>
          ) : (
            "No updates yet"
          )}
        </p>

        <p className="mt-3 flex items-center justify-end gap-1 text-sm font-medium text-muted transition-colors group-hover:text-foreground">
          Open project{" "}
          <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </p>
      </div>
    </Link>
  );
}
