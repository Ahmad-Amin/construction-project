import type { SupabaseClient, User } from "@supabase/supabase-js";
import { queueNotificationDelivery } from "@/lib/notifications";

// What happens right after someone signs in from an email link or Google (/auth/callback and /auth/confirm), now that
// they have a session: an invitation they started with is accepted.
export async function finishSignIn(supabase: SupabaseClient, user: User | null | undefined) {
  // A homeowner who confirmed their email after using an invite link: claim the client record.
  const token = user?.user_metadata?.invite_token;
  if (typeof token === "string") {
    await supabase.rpc("accept_invite", { p_token: token });
    queueNotificationDelivery();
  }

  // A staff member who confirmed their email after using a team invitation link: join the team.
  const staffToken = user?.user_metadata?.staff_invite_token;
  if (typeof staffToken === "string") {
    await supabase.rpc("accept_staff_invite", { p_token: staffToken });
  }
}
