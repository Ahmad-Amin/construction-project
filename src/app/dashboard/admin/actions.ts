"use server";

import { revalidatePath } from "next/cache";
import { platformAdminEmail } from "@/lib/admin";
import { isPlanId } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: boolean; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Every action starts by checking who is asking. Server actions can be called by anyone who knows their
// address, so the page being hidden is not protection: this check is.
export async function setCompanyPlan(companyId: string, plan: string, endDay: string | null): Promise<Result> {
  const admin = await platformAdminEmail();
  if (!admin) return { ok: false, message: "Not allowed." };
  if (!UUID.test(companyId) || !isPlanId(plan)) return { ok: false, message: "That isn't a valid company or plan." };

  let until: string | null = null;
  if (plan !== "free" && endDay) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDay)) return { ok: false, message: "Please give the end date as a day." };
    // Paid up to the end of that day (UTC).
    until = `${endDay}T23:59:59Z`;
    if (Number.isNaN(new Date(until).getTime())) return { ok: false, message: "That date isn't valid." };
  }

  const { error } = await createAdminClient().rpc("admin_set_plan", {
    p_company: companyId,
    p_plan: plan,
    p_until: until,
    p_by: admin,
  });
  if (error) return { ok: false, message: error.message.slice(0, 160) };

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Saved." };
}

export async function dismissPlanRequest(requestId: string): Promise<Result> {
  const admin = await platformAdminEmail();
  if (!admin) return { ok: false, message: "Not allowed." };
  if (!UUID.test(requestId)) return { ok: false, message: "That isn't a valid request." };

  const { error } = await createAdminClient().rpc("admin_dismiss_request", { p_id: requestId });
  if (error) return { ok: false, message: "Could not dismiss it." };

  revalidatePath("/dashboard/admin");
  return { ok: true, message: "Dismissed." };
}
