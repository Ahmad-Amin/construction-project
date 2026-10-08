"use server";

import { revalidatePath } from "next/cache";
import { fetchNotifications, type NotificationItem } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

// The bell's dropdown asks for this when it opens.
export async function listNotifications(): Promise<NotificationItem[]> {
  const supabase = await createClient();
  return fetchNotifications(supabase, 15);
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = await createClient();
  // Row-level security limits this to the person's own notifications.
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  revalidatePath("/dashboard", "layout");
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  revalidatePath("/dashboard", "layout");
}

async function saveProfileFlag(column: "email_notifications", enabled: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { error: "Please sign in again." };

  const { data, error } = await supabase
    .from("profiles")
    .update({ [column]: enabled })
    .eq("id", userId)
    .select("id");
  if (error || !data?.length) return { error: "We couldn't save that. Please try again." };

  revalidatePath("/dashboard/settings");
  return {};
}

export async function setEmailNotifications(enabled: boolean) {
  return saveProfileFlag("email_notifications", enabled);
}
