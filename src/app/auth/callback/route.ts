import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { queueNotificationDelivery } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

// Landing point for magic links and email-confirmation links.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // A homeowner who confirmed their email after using an invite link:
      // claim the client record now that they have a session.
      const token = data.user?.user_metadata?.invite_token;
      if (typeof token === "string") {
        await supabase.rpc("accept_invite", { p_token: token });
        queueNotificationDelivery();
      }

      // They asked for a password reset in this browser: take them to choose a new one.
      const store = await cookies();
      if (store.get("pw_reset")) {
        store.delete("pw_reset");
        return NextResponse.redirect(`${origin}/dashboard/settings?reset=1`);
      }
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
