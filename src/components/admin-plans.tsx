"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { dismissPlanRequest, setCompanyPlan } from "@/app/dashboard/admin/actions";
import { Spinner } from "@/components/spinner";
import { useToast } from "@/components/toast";
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
export type AdminChange = {
  id: string;
  company_name: string;
  old_plan: string;
  old_until: string | null;
  new_plan: string;
  new_until: string | null;
  changed_by: string;
  created_at: string;
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

function Editor({ company, preset, onDone }: { company: AdminCompany; preset?: { plan: PlanId; months: number }; onDone: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const startPlan: PlanId = preset?.plan ?? (isPlanId(company.effective) && company.effective !== "free" ? company.effective : "pro");
  const [plan, setPlan] = useState<PlanId>(startPlan);
  const [end, setEnd] = useState(preset ? extend(company.effective !== "free" ? company.plan_until?.slice(0, 10) ?? null : null, preset.months) : "");
  const [noEnd, setNoEnd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentEnd = company.effective !== "free" ? company.plan_until?.slice(0, 10) ?? null : null;

  function save() {
    setError(null);
    if (plan !== "free" && !noEnd && !end) return setError("Choose an end date, or tick No end date.");
    startTransition(async () => {
      const result = await setCompanyPlan(company.id, plan, plan === "free" || noEnd ? null : end);
      if (!result.ok) return setError(result.message);
      toast.success(`${company.name}: ${PLANS[plan].name}`, plan === "free" ? "Back on Free." : noEnd ? "No end date." : `Paid until ${end}.`);
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-line bg-surface-2/50 p-4">
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <label className="block text-sm font-medium">
          Plan
          <select value={plan} onChange={(e) => setPlan(e.target.value as PlanId)} className={`${inputClass} mt-1.5`}>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="business">Business</option>
          </select>
        </label>
        {plan !== "free" && (
          <div>
            <label className="block text-sm font-medium" htmlFor={`end-${company.id}`}>
              Paid until (the whole of that day)
            </label>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <input
                id={`end-${company.id}`}
                type="date"
                value={end}
                disabled={noEnd}
                onChange={(e) => setEnd(e.target.value)}
                className={`${inputClass} w-44`}
              />
              <button type="button" disabled={noEnd} onClick={() => setEnd(extend(currentEnd, 1))} className={button("secondary", "sm")}>
                +1 month
              </button>
              <button type="button" disabled={noEnd} onClick={() => setEnd(extend(currentEnd, 12))} className={button("secondary", "sm")}>
                +1 year
              </button>
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={noEnd} onChange={(e) => setNoEnd(e.target.checked)} className="size-4 accent-primary" />
              No end date (a gift, or a founder plan)
            </label>
          </div>
        )}
      </div>
      {plan === "free" && <p className="text-sm text-muted">Free has no end date. The company keeps its projects and records.</p>}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={save} className={button("primary", "sm")}>
          {pending && <Spinner className="size-4" />} Save plan
        </button>
        <button type="button" disabled={pending} onClick={onDone} className={button("secondary", "sm")}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function AdminPlans({ companies, requests, changes }: { companies: AdminCompany[]; requests: AdminRequest[]; changes: AdminChange[] }) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<{ id: string; preset?: { plan: PlanId; months: number } } | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => `${c.name} ${c.owner_email ?? ""} ${c.owner_name ?? ""}`.toLowerCase().includes(q));
  }, [companies, query]);

  function dismiss(id: string) {
    startTransition(async () => {
      const r = await dismissPlanRequest(id);
      if (r.ok) {
        toast.success("Dismissed");
        router.refresh();
      } else toast.error(r.message);
    });
  }

  return (
    <div className="space-y-10">
      <section aria-label="Open requests">
        <h2 className="text-lg font-bold tracking-tight">
          Requests <span className="ml-1 text-sm font-normal text-muted">{requests.length} open</span>
        </h2>
        {requests.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No open requests.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {requests.map((r) => {
              const company = companies.find((c) => c.id === r.company_id);
              return (
                <li key={r.id} className="rounded-2xl border border-primary/40 bg-primary-soft/30 p-4">
                  <p className="font-semibold">
                    {r.company_name} wants {isPlanId(r.plan) ? PLANS[r.plan].name : r.plan}
                    <span className="font-normal text-muted"> · {r.yearly ? "yearly" : "monthly"}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    {r.requested_by_email ?? "unknown"} · {new Date(r.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
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
        )}
      </section>

      <section aria-label="Companies">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight">
            Companies <span className="ml-1 text-sm font-normal text-muted">{companies.length}</span>
          </h2>
          <label className="relative block w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <span className="sr-only">Search companies</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email" className={`${inputClass} pl-9`} />
          </label>
        </div>

        <ul className="mt-4 space-y-3">
          {shown.map((c) => {
            const lapsed = (c.plan === "pro" || c.plan === "business") && c.effective === "free";
            const isOpen = open?.id === c.id;
            return (
              <li key={c.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{c.name}</p>
                    <p className="mt-0.5 break-all text-sm text-muted">
                      {c.owner_name ? `${c.owner_name} · ` : ""}
                      {c.owner_email ?? "no owner email"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {c.active_projects} active · {c.total_projects} {c.total_projects === 1 ? "project" : "projects"} · joined {c.created_at.slice(0, 10)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        c.effective === "free" ? "bg-surface-2 text-muted" : "bg-success-soft text-success"
                      }`}
                    >
                      {isPlanId(c.effective) ? PLANS[c.effective].name : c.effective}
                    </span>
                    <p className="mt-1 text-xs text-muted">
                      {c.effective === "free" ? (lapsed ? `ended ${day(c.plan_until)}` : "") : `until ${day(c.plan_until)}`}
                    </p>
                  </div>
                </div>
                {isOpen ? (
                  <Editor key={`${c.id}-${open?.preset?.plan ?? ""}`} company={c} preset={open?.preset} onDone={() => setOpen(null)} />
                ) : (
                  <button type="button" onClick={() => setOpen({ id: c.id })} className={`${button("secondary", "sm")} mt-3`}>
                    Change plan
                  </button>
                )}
              </li>
            );
          })}
          {shown.length === 0 && <li className="text-sm text-muted">No company matches.</li>}
        </ul>
      </section>

      <section aria-label="Recent changes">
        <h2 className="text-lg font-bold tracking-tight">Recent changes</h2>
        {changes.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing changed yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
            {changes.map((h) => (
              <li key={h.id} className="px-4 py-3">
                <span className="font-medium">{h.company_name}</span>: {h.old_plan} to {h.new_plan}
                {h.new_until ? ` until ${day(h.new_until)}` : h.new_plan !== "free" ? " with no end date" : ""}
                <span className="block text-xs text-muted">
                  {h.changed_by} · {new Date(h.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
