"use server";

import { revalidatePath } from "next/cache";
import { platformAdminEmail } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Mark a piece of feedback done, or bring it back. Checked on the server, like every admin action.
export async function setFeedbackStatus(id: string, status: "new" | "done"): Promise<{ ok: boolean; message: string }> {
  if (!(await platformAdminEmail())) return { ok: false, message: "Not allowed." };
  if (!UUID.test(id) || (status !== "new" && status !== "done")) return { ok: false, message: "That isn't valid." };
  const { error } = await createAdminClient().rpc("admin_set_feedback_status", { p_id: id, p_status: status });
  if (error) return { ok: false, message: "Could not save that." };
  revalidatePath("/dashboard/admin", "layout");
  return { ok: true, message: "Saved." };
}
