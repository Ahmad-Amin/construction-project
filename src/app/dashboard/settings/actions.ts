"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/login/actions";
import { isDemoEmail } from "@/lib/demo";
import { text } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

const GENERIC = "Something went wrong. Please try again.";
const LOGO_BUCKET = "company-logos";

function refresh() {
  revalidatePath("/dashboard", "layout");
}

export async function updateProfile(_: FormState, formData: FormData): Promise<FormState> {
  const name = text(formData, "name");
  if (!name) return { error: "Please enter your name." };
  if (name.length > 80) return { error: "Please keep your name under 80 characters." };

  const viewer = await getViewer();
  if (!viewer) return { error: "Please sign in again." };

  const supabase = await createClient();
  // RLS only lets you change your own profile.
  const { data, error } = await supabase
    .from("profiles")
    .update({ name })
    .eq("id", viewer.userId)
    .select("id");
  if (error || !data?.length) return { error: GENERIC };

  refresh();
  return { message: "Saved." };
}

export async function changePassword(_: FormState, formData: FormData): Promise<FormState> {
  // The demo accounts are shared by everyone who tries the demo.
  const viewer = await getViewer();
  if (isDemoEmail(viewer?.email)) {
    return { error: "This is a demo account, so its password can't be changed." };
  }

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Your password needs at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      error: /same|different/i.test(error.message)
        ? "Please choose a password you haven't used before."
        : "We couldn't change your password. Please try again.",
    };
  }
  // `values.at` is unique per save, so the form can tell a second success from the first.
  return { message: "Your password has been changed.", values: { at: String(Date.now()) } };
}

export async function updateCompanyName(_: FormState, formData: FormData): Promise<FormState> {
  const name = text(formData, "name");
  if (!name) return { error: "Please enter your company name." };
  if (name.length > 100) return { error: "Please keep the company name under 100 characters." };

  const viewer = await getViewer();
  if (viewer?.company?.role !== "owner") {
    return { error: "Only the company owner can change company settings." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .update({ name })
    .eq("id", viewer.company.id)
    .select("id");
  if (error || !data?.length) return { error: GENERIC };

  refresh();
  return { message: "Saved." };
}

// The file is already uploaded; this points the company at it (or clears it with null).
export async function setCompanyLogo(path: string | null): Promise<{ error?: string }> {
  const viewer = await getViewer();
  if (viewer?.company?.role !== "owner") {
    return { error: "Only the company owner can change the logo." };
  }
  const companyId = viewer.company.id;
  if (path !== null && (!path.startsWith(`${companyId}/`) || path.includes(".."))) {
    return { error: GENERIC };
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("companies")
    .select("logo_url")
    .eq("id", companyId)
    .maybeSingle();

  const logoUrl = path ? supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl : null;
  const { data, error } = await supabase
    .from("companies")
    .update({ logo_url: logoUrl })
    .eq("id", companyId)
    .select("id");
  if (error || !data?.length) return { error: GENERIC };

  // Tidy away the old file now that nothing points at it.
  const marker = `/${LOGO_BUCKET}/`;
  const oldUrl = current?.logo_url as string | null | undefined;
  if (oldUrl && oldUrl.includes(marker)) {
    const oldPath = decodeURIComponent(oldUrl.split(marker)[1].split("?")[0]);
    if (oldPath.startsWith(`${companyId}/`) && oldPath !== path) {
      await supabase.storage.from(LOGO_BUCKET).remove([oldPath]);
    }
  }

  refresh();
  return {};
}

// The master switch for the weekly client summary. Off until the contractor turns it on.
export async function setCompanyWeeklySummary(enabled: boolean): Promise<{ error?: string }> {
  const viewer = await getViewer();
  if (viewer?.company?.role !== "owner") {
    return { error: "Only the company owner can change company settings." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .update({ weekly_summary: enabled })
    .eq("id", viewer.company.id)
    .select("id");
  if (error || !data?.length) return { error: "We couldn't save that. Please try again." };
  revalidatePath("/dashboard", "layout");
  return {};
}
