import { createAdminClient } from "@/lib/supabase/admin";

// How many pieces of feedback nobody has dealt with yet: the badge on the Feedback tab. Only ever called
// by admin pages, after they have checked who is asking.
export async function newFeedbackCount(): Promise<number> {
  const { data } = await createAdminClient().rpc("admin_feedback_new_count");
  return typeof data === "number" ? data : 0;
}
