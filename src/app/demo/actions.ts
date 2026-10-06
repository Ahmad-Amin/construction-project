"use server";

import { redirect } from "next/navigation";
import { getDemoConfig } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";

// One tap into the sample project, as the contractor or as the homeowner.
export async function enterDemo(formData: FormData) {
  const demo = getDemoConfig();
  if (!demo) redirect("/login");

  const asClient = formData.get("as") === "client";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: asClient ? demo.clientEmail : demo.contractorEmail,
    password: demo.password,
  });
  if (error) redirect("/login?error=demo");
  redirect("/dashboard");
}
