import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

// The people allowed to use the plans admin page: PLATFORM_ADMIN_EMAILS in the server's settings, a comma
// separated list. Not a NEXT_PUBLIC_ variable, so it is never sent to a browser. Empty means nobody.
export function platformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// The signed-in person's email when they are on the list and their address is confirmed; otherwise null.
// The confirmation matters: an address nobody has proved they own must never open the admin page.
export async function platformAdminEmail(): Promise<string | null> {
  const viewer = await getViewer();
  if (!viewer?.email) return null;
  if (!platformAdminEmails().includes(viewer.email.toLowerCase())) return null;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email_confirmed_at) return null;
  if (data.user.email?.toLowerCase() !== viewer.email.toLowerCase()) return null;
  return viewer.email.toLowerCase();
}

// For the page: anyone else sees the ordinary "not found" page, so its existence isn't revealed.
export async function requirePlatformAdmin(): Promise<string> {
  const email = await platformAdminEmail();
  if (!email) notFound();
  return email;
}
