"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { formatDate } from "@/lib/format";
import { inputClass } from "@/lib/ui";

export type PlanChange = {
  id: string;
  company_id: string;
  company_name: string;
  old_plan: string;
  old_until: string | null;
  new_plan: string;
  new_until: string | null;
  changed_by: string;
  created_at: string;
};

const name = (plan: string) => plan.charAt(0).toUpperCase() + plan.slice(1);
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
const ends = (plan: string, until: string | null) => (plan === "free" ? "" : until ? `until ${formatDate(until.slice(0, 10))}` : "no end date");

function Side({ plan, until }: { plan: string; until: string | null }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5">
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${plan === "free" ? "bg-surface-2 text-muted" : "bg-success-soft text-success"}`}>{name(plan)}</span>
      {ends(plan, until) && <span className="text-xs text-muted">{ends(plan, until)}</span>}
    </span>
  );
}

// Every plan change, newest first: when, which company, from what to what, and who made it.
export function AdminHistory({ changes }: { changes: PlanChange[] }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? changes.filter((c) => `${c.company_name} ${c.changed_by} ${c.old_plan} ${c.new_plan}`.toLowerCase().includes(q)) : changes;
  }, [changes, query]);

  return (
    <section aria-label="Plan changes">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">
          Plan changes <span className="ml-1 text-sm font-normal text-muted">{shown.length === changes.length ? changes.length : `${shown.length} of ${changes.length}`}</span>
        </h2>
        <label className="relative block w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <span className="sr-only">Search the history</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search company or who changed it" className={`${inputClass} pl-9`} />
        </label>
      </div>

      {changes.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
          Nothing has changed yet. Every plan you set from the Companies tab shows up here.
        </p>
      ) : (
        <>
          <div className="mt-4 hidden overflow-hidden rounded-2xl border border-line bg-surface md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2/50 text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-5 py-3 font-semibold">When</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Company</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Change</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Changed by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap px-5 py-3.5 align-top text-muted">{when(c.created_at)}</td>
                    <td className="px-3 py-3.5 align-top font-semibold">{c.company_name}</td>
                    <td className="px-3 py-3.5 align-top">
                      <span className="inline-flex flex-wrap items-center gap-2">
                        <Side plan={c.old_plan} until={c.old_until} />
                        <ArrowRight className="size-4 text-muted" aria-label="changed to" />
                        <Side plan={c.new_plan} until={c.new_until} />
                      </span>
                    </td>
                    <td className="break-all px-5 py-3.5 align-top text-muted">{c.changed_by || "unknown"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted">No change matches.</p>}
          </div>

          <ul className="mt-4 space-y-3 md:hidden">
            {shown.map((c) => (
              <li key={c.id} className="rounded-2xl border border-line bg-surface p-4">
                <p className="font-semibold">{c.company_name}</p>
                <p className="mt-2 inline-flex flex-wrap items-center gap-2">
                  <Side plan={c.old_plan} until={c.old_until} />
                  <ArrowRight className="size-4 text-muted" aria-label="changed to" />
                  <Side plan={c.new_plan} until={c.new_until} />
                </p>
                <p className="mt-2 break-all text-xs text-muted">
                  {c.changed_by || "unknown"} · {when(c.created_at)}
                </p>
              </li>
            ))}
            {shown.length === 0 && <li className="py-6 text-center text-sm text-muted">No change matches.</li>}
          </ul>
        </>
      )}
    </section>
  );
}
