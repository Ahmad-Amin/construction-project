import { notFound } from "next/navigation";
import { AdminTabs } from "@/components/admin-tabs";
import { AdminPlans, type AdminCompany, type AdminRequest } from "@/components/admin-plans";
import { requirePlatformAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Plans admin", robots: { index: false, follow: false } };

// Only the people listed in PLATFORM_ADMIN_EMAILS get here; everyone else sees the ordinary "not found".
export default async function AdminPage() {
  await requirePlatformAdmin();

  const { data, error } = await createAdminClient().rpc("admin_overview");
  if (error || !data) notFound();
  const overview = data as { companies: AdminCompany[]; requests: AdminRequest[] };

  return (
    <main className="w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <h1 className="text-2xl font-bold tracking-tight">Plans</h1>
      <p className="mt-1 mb-6 max-w-3xl text-sm text-muted">
        Change a company&apos;s plan after you have been paid. A paid plan counts until the end of the day you choose, then the
        company goes back to Free by itself. Nothing is deleted when a plan ends.
      </p>
      <AdminTabs />
      <AdminPlans companies={overview.companies} requests={overview.requests} />
    </main>
  );
}
