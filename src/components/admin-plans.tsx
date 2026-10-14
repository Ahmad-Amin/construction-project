"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { dismissPlanRequest, setCompanyPlan } from "@/app/dashboard/admin/actions";
import { DateField } from "@/components/date-field";
import { Spinner } from "@/components/spinner";
import { useToast } from "@/components/toast";
import { formatDate } from "@/lib/format";
import { PLANS, isPlanId, type PlanId } from "@/lib/plans";
import { button, inputClass } from "@/lib/ui";

export type AdminCompany = {
  id: string;
  name: string;
  plan: string;
  plan_until: string | null;
  effective: string;
  owner_email: string | null;
  owner_name: string | null;
  active_projects: number;
  total_projects: number;
  created_at: string;
};
export type AdminRequest = {
  id: string;
  company_id: string;
  company_name: string;
  plan: string;
  yearly: boolean;
  created_at: string;
  requested_by_email: string | null;
};
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "no end date");
const today = () => new Date().toISOString().slice(0, 10);

// A month or a year after a day (or after today, if that day has passed): the usual "paid until".
function extend(from: string | null, months: number): string {
  const start = from && from > today() ? from : today();
  const d = new Date(`${start}T00:00:00Z`);
  const wantedDay = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // 31 January + 1 month should be the end of February, not 3 March.
  if (d.getUTCDate() !== wantedDay) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

type Duration = "month" | "quarter" | "year" | "custom" | "none";
const DURATIONS: { id: Duration; label: string; months?: number }[] = [
  { id: "month", label: "+1 month", months: 1 },
  { id: "quarter", label: "+3 months", months: 3 },
  { id: "year", label: "+1 year", months: 12 },
  { id: "custom", label: "Pick a date" },
  { id: "none", label: "No end date" },
];
const PLAN_BLURB: Record<PlanId, string> = { free: "1 active project", pro: "Up to 10 projects", business: "Unlimited projects" };

// "14 Nov 2026" and how far away that is.
function describe(isoDay: string): string {
  const days = Math.round((new Date(`${isoDay}T00:00:00Z`).getTime() - new Date(`${today()}T00:00:00Z`).getTime()) / 86_400_000);
  const when = days <= 0 ? "today" : days === 1 ? "tomorrow" : days < 60 ? `in ${days} days` : `in about ${Math.round(days / 30)} months`;
  return `${formatDate(isoDay)} · ${when}`;
}

function Editor({ company, preset, onDone }: { company: AdminCompany; preset?: { plan: PlanId; months: number }; onDone: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const startPlan: PlanId = preset?.plan ?? (isPlanId(company.effective) && company.effective !== "free" ? company.effective : "pro");
  const [plan, setPlan] = useState<PlanId>(startPlan);
  const [duration, setDuration] = useState<Duration>(preset ? (preset.months >= 12 ? "year" : preset.months >= 3 ? "quarter" : "month") : "month");
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);

  // A running paid plan is extended from its end date; one that has ended starts again from today.
  const currentEnd = company.effective !== "free" ? company.plan_until?.slice(0, 10) ?? null : null;
  const months = DURATIONS.find((d) => d.id === duration)?.months;
  const end: string | null = plan === "free" || duration === "none" ? null : duration === "custom" ? custom || null : extend(currentEnd, months ?? 1);
  const missingDate = plan !== "free" && duration !== "none" && !end;

  function save() {
    setError(null);
    if (missingDate) return setError("Pick the date the plan is paid until.");
    startTransition(async () => {
      const result = await setCompanyPlan(company.id, plan, end);
      if (!result.ok) return setError(result.message);
      toast.success(`${company.name}: ${PLANS[plan].name}`, plan === "free" ? "Back on Free." : end ? `Paid until ${formatDate(end)}.` : "No end date.");
      onDone();
      router.refresh();
    });
  }

  const now = isPlanId(company.effective) ? PLANS[company.effective].name : company.effective;

  return (
    <div className="mt-4 space-y-6 rounded-2xl border border-line bg-surface-2/40 p-5">
      <div>
        <p className="text-sm font-semibold">Plan</p>
        <div role="radiogroup" aria-label="Plan" className="mt-2 grid gap-2 sm:grid-cols-3">
          {(["free", "pro", "business"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={plan === id}
              onClick={() => {
                setPlan(id);
                setError(null);
              }}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                plan === id ? "border-primary bg-primary-soft" : "border-line bg-surface hover:bg-surface-2"
              }`}
            >
              <span className="block text-sm font-semibold">{PLANS[id].name}</span>
              <span className="block text-xs text-muted">{PLAN_BLURB[id]}</span>
            </button>
          ))}
        </div>
      </div>

      {plan !== "free" && (
        <div>
          <p className="text-sm font-semibold">Paid until</p>
          <div role="radiogroup" aria-label="Paid until" className="mt-2 flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={duration === d.id}
                onClick={() => {
                  setDuration(d.id);
                  setError(null);
                }}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  duration === d.id ? "border-primary bg-primary-soft text-foreground" : "border-line bg-surface text-muted hover:text-foreground"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          {duration === "custom" && (
            <div className="mt-3 max-w-xs">
              <DateField value={custom} onValueChange={(day) => {
                setCustom(day);
                setError(null);
              }} min={today()} today={today()} placeholder="Choose the last paid day" />
            </div>
          )}
          {currentEnd && duration !== "custom" && duration !== "none" && (
            <p className="mt-2 text-xs text-muted">Counted from the current end date, {formatDate(currentEnd)}, so a renewal doesn&apos;t lose paid days.</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
        <p className="text-sm">
          <span className="text-muted">Now: </span>
          {now}
          {currentEnd ? ` until ${formatDate(currentEnd)}` : ""}
          <span className="mx-2 text-muted" aria-hidden>
            →
          </span>
          <span className="font-semibold">
            {PLANS[plan].name}
            {plan !== "free" && (end ? ` until ${describe(end)}` : duration === "none" ? ", no end date" : "")}
          </span>
        </p>
        <div className="flex gap-2">
          <button type="button" disabled={pending} onClick={onDone} className={button("secondary", "sm")}>
            Cancel
          </button>
          <button type="button" disabled={pending} onClick={save} className={button("primary", "sm")}>
            {pending && <Spinner className="size-4" />} Save plan
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="-mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

type Filter = "all" | "free" | "pro" | "business" | "ending" | "lapsed";

const stamp = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
const daysUntil = (iso: string) => Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);

function PlanBadge({ company }: { company: AdminCompany }) {
  const free = company.effective === "free";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${free ? "bg-surface-2 text-muted" : "bg-success-soft text-success"}`}>
      {isPlanId(company.effective) ? PLANS[company.effective].name : company.effective}
    </span>
  );
}

// What to show under the plan: when it ends, when it ended, or nothing for a plain Free company.
function endNote(c: AdminCompany): { text: string; tone: "ok" | "warn" | "muted" } | null {
  const paid = c.effective === "pro" || c.effective === "business";
  const everPaid = c.plan === "pro" || c.plan === "business";
  if (paid && c.plan_until) {
    const d = daysUntil(c.plan_until);
    return { text: `Ends ${formatDate(day(c.plan_until))}${d >= 0 && d <= 14 ? ` · ${d === 0 ? "today" : `in ${d} ${d === 1 ? "day" : "days"}`}` : ""}`, tone: d <= 14 ? "warn" : "muted" };
  }
  if (paid) return { text: "No end date", tone: "muted" };
  if (everPaid && c.plan_until) return { text: `Ended ${formatDate(day(c.plan_until))}`, tone: "warn" };
  return null;
}

function Stat({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${tone}`}>{value}</p>
    </div>
  );
}

export function AdminPlans({ companies, requests }: { companies: AdminCompany[]; requests: AdminRequest[] }) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<{ id: string; preset?: { plan: PlanId; months: number } } | null>(null);
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const paid = (c: AdminCompany) => c.effective === "pro" || c.effective === "business";
    return {
      all: companies.length,
      free: companies.filter((c) => c.effective === "free").length,
      pro: companies.filter((c) => c.effective === "pro").length,
      business: companies.filter((c) => c.effective === "business").length,
      ending: companies.filter((c) => paid(c) && c.plan_until && daysUntil(c.plan_until) <= 14).length,
      lapsed: companies.filter((c) => (c.plan === "pro" || c.plan === "business") && c.effective === "free").length,
    } satisfies Record<Filter, number>;
  }, [companies]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies.filter((c) => {
      if (filter === "free" && c.effective !== "free") return false;
      if (filter === "pro" && c.effective !== "pro") return false;
      if (filter === "business" && c.effective !== "business") return false;
      if (filter === "ending" && !((c.effective === "pro" || c.effective === "business") && c.plan_until && daysUntil(c.plan_until) <= 14)) return false;
      if (filter === "lapsed" && !((c.plan === "pro" || c.plan === "business") && c.effective === "free")) return false;
      return !q || `${c.name} ${c.owner_email ?? ""} ${c.owner_name ?? ""}`.toLowerCase().includes(q);
    });
  }, [companies, query, filter]);

  function dismiss(id: string) {
    startTransition(async () => {
      const r = await dismissPlanRequest(id);
      if (r.ok) {
        toast.success("Dismissed");
        router.refresh();
      } else toast.error(r.message);
    });
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "free", label: "Free" },
    { id: "pro", label: "Pro" },
    { id: "business", label: "Business" },
    { id: "ending", label: "Ending soon" },
    { id: "lapsed", label: "Lapsed" },
  ];

  const editorFor = (c: AdminCompany) =>
    open?.id === c.id ? <Editor key={`${c.id}-${open.preset?.plan ?? ""}`} company={c} preset={open.preset} onDone={() => setOpen(null)} /> : null;

  return (
    <div className="space-y-8">
      <section aria-label="Overview" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Companies" value={counts.all} />
        <Stat label="On Pro" value={counts.pro} tone={counts.pro ? "text-success" : ""} />
        <Stat label="On Business" value={counts.business} tone={counts.business ? "text-success" : ""} />
        <Stat label="On Free" value={counts.free} />
        <Stat label="Open requests" value={requests.length} tone={requests.length ? "text-primary-hover" : ""} />
      </section>

      <div className="space-y-8">
        <div className="min-w-0 space-y-8">
          {requests.length > 0 && (
            <section aria-label="Open requests">
              <h2 className="text-lg font-bold tracking-tight">
                Requests <span className="ml-1 text-sm font-normal text-muted">{requests.length} waiting for you</span>
              </h2>
              <ul className="mt-3 grid gap-3 lg:grid-cols-2">
                {requests.map((r) => {
                  const company = companies.find((c) => c.id === r.company_id);
                  return (
                    <li key={r.id} className="rounded-2xl border border-primary/40 bg-primary-soft/30 p-4">
                      <p className="font-semibold">
                        {r.company_name} wants {isPlanId(r.plan) ? PLANS[r.plan].name : r.plan}
                        <span className="font-normal text-muted"> · {r.yearly ? "yearly" : "monthly"}</span>
                      </p>
                      <p className="mt-0.5 break-all text-sm text-muted">
                        {r.requested_by_email ?? "unknown"} · {stamp(r.created_at)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {company && isPlanId(r.plan) && (
                          <button
                            type="button"
                            onClick={() => setOpen({ id: company.id, preset: { plan: r.plan as PlanId, months: r.yearly ? 12 : 1 } })}
                            className={button("primary", "sm")}
                          >
                            Set {PLANS[r.plan as PlanId].name} {r.yearly ? "for a year" : "for a month"}
                          </button>
                        )}
                        <button type="button" disabled={pending} onClick={() => dismiss(r.id)} className={button("secondary", "sm")}>
                          Dismiss
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section aria-label="Companies">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold tracking-tight">
                Companies <span className="ml-1 text-sm font-normal text-muted">{shown.length === companies.length ? companies.length : `${shown.length} of ${companies.length}`}</span>
              </h2>
              <label className="relative block w-full sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <span className="sr-only">Search companies</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email" className={`${inputClass} pl-9`} />
              </label>
            </div>

            <div role="group" aria-label="Filter companies" className="mt-3 flex flex-wrap gap-2">
              {filters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    filter === f.id ? "border-primary bg-primary-soft text-foreground" : "border-line bg-surface text-muted hover:text-foreground"
                  }`}
                >
                  {f.label}
                  <span className="text-xs tabular-nums text-muted">{counts[f.id]}</span>
                </button>
              ))}
            </div>

            {/* A table on wide screens ... */}
            <div className="mt-4 hidden overflow-hidden rounded-2xl border border-line bg-surface md:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2/50 text-xs uppercase tracking-wide text-muted">
                    <th scope="col" className="px-5 py-3 font-semibold">Company</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Plan</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Projects</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Joined</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {shown.map((c) => {
                    const note = endNote(c);
                    return (
                      <FragmentRows key={c.id} editor={editorFor(c)}>
                        <td className="px-5 py-4 align-top">
                          <p className="font-semibold">{c.name}</p>
                          <p className="mt-0.5 break-all text-xs text-muted">
                            {c.owner_name ? `${c.owner_name} · ` : ""}
                            {c.owner_email ?? "no owner email"}
                          </p>
                        </td>
                        <td className="px-3 py-4 align-top">
                          <PlanBadge company={c} />
                          {note && <p className={`mt-1 text-xs ${note.tone === "warn" ? "font-medium text-primary-hover" : "text-muted"}`}>{note.text}</p>}
                        </td>
                        <td className="px-3 py-4 align-top tabular-nums">
                          {c.active_projects} active
                          <span className="block text-xs text-muted">{c.total_projects} in total</span>
                        </td>
                        <td className="px-3 py-4 align-top text-muted">{formatDate(day(c.created_at))}</td>
                        <td className="px-5 py-4 text-right align-top">
                          {open?.id !== c.id && (
                            <button type="button" onClick={() => setOpen({ id: c.id })} className={button("secondary", "sm")}>
                              Change plan
                            </button>
                          )}
                        </td>
                      </FragmentRows>
                    );
                  })}
                </tbody>
              </table>
              {shown.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted">No company matches.</p>}
            </div>

            {/* ... and cards on phones. */}
            <ul className="mt-4 space-y-3 md:hidden">
              {shown.map((c) => {
                const note = endNote(c);
                return (
                  <li key={c.id} className="rounded-2xl border border-line bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{c.name}</p>
                        <p className="mt-0.5 break-all text-xs text-muted">
                          {c.owner_name ? `${c.owner_name} · ` : ""}
                          {c.owner_email ?? "no owner email"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <PlanBadge company={c} />
                        {note && <p className={`mt-1 text-xs ${note.tone === "warn" ? "font-medium text-primary-hover" : "text-muted"}`}>{note.text}</p>}
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      {c.active_projects} active · {c.total_projects} in total · joined {formatDate(day(c.created_at))}
                    </p>
                    {open?.id === c.id ? (
                      editorFor(c)
                    ) : (
                      <button type="button" onClick={() => setOpen({ id: c.id })} className={`${button("secondary", "sm")} mt-3`}>
                        Change plan
                      </button>
                    )}
                  </li>
                );
              })}
              {shown.length === 0 && <li className="py-6 text-center text-sm text-muted">No company matches.</li>}
            </ul>
          </section>
        </div>

      </div>
    </div>
  );
}

// A table row, and under it (while a company is being edited) a row that spans the whole table.
function FragmentRows({ children, editor }: { children: React.ReactNode; editor: React.ReactNode }) {
  return (
    <>
      <tr>{children}</tr>
      {editor && (
        <tr>
          <td colSpan={5} className="bg-surface-2/20 px-5 pb-5">
            {editor}
          </td>
        </tr>
      )}
    </>
  );
}
