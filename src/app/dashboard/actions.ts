"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isCurrency } from "@/lib/currency";
import { isTimeZone } from "@/lib/timezone";
import { flash } from "@/lib/flash";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/app/login/actions";

export async function createCompany(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Please enter your company name." };

  const currency = String(formData.get("currency") ?? "");
  if (!isCurrency(currency)) return { error: "Please choose the currency you work in." };

  const timeZone = String(formData.get("timezone") ?? "");
  if (!isTimeZone(timeZone)) return { error: "Please choose your time zone." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_company", { p_name: name, p_currency: currency, p_timezone: timeZone });
  if (error) {
    return { error: "We couldn't set up your company. Please try again." };
  }
  await flash("Your company is set up");
  redirect("/dashboard");
}

// "Hide checklist" on the dashboard. It stays hidden for this person from then on.
export async function dismissGettingStarted(): Promise<void> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return;

  await supabase
    .from("profiles")
    .update({ getting_started_dismissed_at: new Date().toISOString() })
    .eq("id", userId);
  revalidatePath("/dashboard");
}
