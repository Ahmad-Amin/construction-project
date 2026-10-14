import { notFound } from "next/navigation";
import { AdminHistory, type PlanChange } from "@/components/admin-history";
import { AdminTabs } from "@/components/admin-tabs";
import { requirePlatformAdmin } from "@/lib/admin";
import { newFeedbackCount } from "@/lib/admin-data";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Plan history", robots: { index: false, follow: false } };

// Every plan change ever made from the admin page. Same rule as the page it belongs to: only the people
// in PLATFORM_ADMIN_EMAILS get here, and everyone else sees "not found".
export default async function AdminHistoryPage() {
  await requirePlatformAdmin();

  const { data, error } = await createAdminClient().rpc("admin_plan_history", { p_limit: 300 });
  if (error || !data) notFound();

  return (
    <main className="w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <h1 className="text-2xl font-bold tracking-tight">Plans</h1>
      <p className="mt-1 mb-6 max-w-3xl text-sm text-muted">
        A record of every plan change: what it was, what it became, who made the change and when. Nothing here can be edited.
      </p>
      <AdminTabs newFeedback={await newFeedbackCount()} />
      <AdminHistory changes={data as PlanChange[]} />
    </main>
  );
}
