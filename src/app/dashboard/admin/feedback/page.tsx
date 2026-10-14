import { notFound } from "next/navigation";
import { AdminFeedback, type FeedbackItem } from "@/components/admin-feedback";
import { AdminTabs } from "@/components/admin-tabs";
import { requirePlatformAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Feedback", robots: { index: false, follow: false } };

// What people sent from the "Send feedback" button. Same rule as the rest of the admin area: only the
// people in PLATFORM_ADMIN_EMAILS get here, and everyone else sees "not found".
export default async function AdminFeedbackPage() {
  await requirePlatformAdmin();

  const { data, error } = await createAdminClient().rpc("admin_feedback", { p_limit: 300 });
  if (error || !data) notFound();
  const items = data as FeedbackItem[];

  return (
    <main className="w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <h1 className="text-2xl font-bold tracking-tight">Plans</h1>
      <p className="mt-1 mb-6 max-w-3xl text-sm text-muted">What people wrote from inside the app. Reply from here, then mark it done.</p>
      <AdminTabs newFeedback={items.filter((i) => i.status === "new").length} />
      <AdminFeedback items={items} />
    </main>
  );
}
