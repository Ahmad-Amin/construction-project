import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { emptyProjectValues, ProjectForm } from "@/components/project-form";
import { phoneCountryFor } from "@/lib/phone";
import { PlanLimitCard } from "@/components/plan-limit-card";
import { usage } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { createProject } from "../actions";

export const metadata = { title: "New project" };

export default async function NewProjectPage() {
  const viewer = await getViewer();
  if (viewer?.company?.role !== "owner") redirect("/dashboard");

  // At the plan's limit there is nothing to fill in: say so, and what to do. (The database refuses
  // the project too, so this is only the friendly version of a rule that can't be got round.)
  const supabase = await createClient();
  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .is("archived_at", null);
  const active = count ?? 0;
  if (usage(viewer.company.plan, active).atLimit) {
    return (
      <main className="w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <h1 className="text-2xl font-bold tracking-tight">New project</h1>
        <div className="mt-6">
          <PlanLimitCard plan={viewer.company.plan} activeProjects={active} />
        </div>
      </main>
    );
  }

  return (
    <main className="w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <h1 className="text-2xl font-bold tracking-tight">New project</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Add the project and your client. You&apos;ll get a link to invite them next.
      </p>
      <ProjectForm
        action={createProject}
        mode="create"
        defaults={emptyProjectValues}
        currency={viewer.company.currency}
        phoneCountry={phoneCountryFor((await headers()).get("x-vercel-ip-country"), viewer.company.timeZone)}
        cancelHref="/dashboard"
      />
    </main>
  );
}
