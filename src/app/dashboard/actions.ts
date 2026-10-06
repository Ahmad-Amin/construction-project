"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/app/login/actions";

export async function createCompany(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Please enter your company name." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_company", { p_name: name });
  if (error) {
    return { error: "We couldn't set up your company. Please try again." };
  }
  redirect("/dashboard");
}
