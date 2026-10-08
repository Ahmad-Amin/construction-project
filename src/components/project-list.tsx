"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { ProjectCard } from "@/components/project-card";
import type { DashboardProject } from "@/lib/dashboard";
import { projectStatusStyle } from "@/lib/project";
import type { ProjectStatus } from "@/lib/types";
import { inputClass } from "@/lib/ui";

type Filter = "all" | ProjectStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: projectStatusStyle.active.label },
  { value: "on_hold", label: projectStatusStyle.on_hold.label },
  { value: "completed", label: projectStatusStyle.completed.label },
];

// The dashboard's project grid with a heading, a name search and a status filter. Filtering
// happens in the browser: everything is already loaded.
export function ProjectList({
  projects,
  title,
  perspective,
}: {
  projects: DashboardProject[];
  title: string;
  perspective: "company" | "client";
}) {
  const [status, setStatus] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const counts = (value: Filter) => (value === "all" ? projects.length : projects.filter((p) => p.status === value).length);

  const needle = query.trim().toLowerCase();
  const shown = projects.filter(
    (p) =>
      (status === "all" || p.status === status) &&
      (!needle ||
        [p.name, p.location, p.clientName ?? "", p.companyName ?? ""].some((field) => field.toLowerCase().includes(needle))),
  );
  const filtering = status !== "all" || needle !== "";

  return (
    <section aria-label="Projects">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h2 className="text-lg font-semibold">
          {title}
          <span className="ml-2 text-sm font-normal text-muted">
            {filtering ? `${shown.length} of ${projects.length}` : projects.length}
          </span>
        </h2>

        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {FILTERS.map(({ value, label }) => {
            const active = status === value;
            const count = counts(value);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                disabled={count === 0 && !active}
                onClick={() => setStatus(value)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                  active
                    ? "border-primary bg-primary-soft text-foreground"
                    : "border-line bg-surface text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                {value !== "all" && (
                  <span className={`size-1.5 rounded-full ${projectStatusStyle[value].dot}`} aria-hidden />
                )}
                {label}
                <span className="text-xs tabular-nums opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        <label className="relative block w-full sm:w-64">
          <span className="sr-only">Search projects</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects"
            className={`${inputClass} py-1.5 pl-9 text-sm [&::-webkit-search-cancel-button]:hidden`}
          />
        </label>
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center">
          <p className="font-semibold">No projects match</p>
          <p className="mt-1 text-sm text-muted">Try a different search or status.</p>
          <button
            type="button"
            onClick={() => {
              setStatus("all");
              setQuery("");
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-surface-2"
          >
            <X className="size-4" aria-hidden /> Clear filters
          </button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {shown.map((p, i) => (
            <ProjectCard key={p.id} project={p} perspective={perspective} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}
