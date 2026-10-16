import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { isFirstGoogleSignIn } from "@/lib/auth-flow";
import { queueNotificationDelivery } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

// Landing point for magic links, email-confirmation links and "Continue with Google".
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  // The person closed or refused the Google window: say so, rather than blaming an expired link.
  if (!code && searchParams.get("error")) {
    return NextResponse.redirect(`${origin}/login?error=google`);
  }

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
      // Someone who has just created their account with Google passes a short public page first, so the
      // sign-up can be counted in analytics (the dashboard itself is never tracked).
      if (isFirstGoogleSignIn(data.user)) return NextResponse.redirect(`${origin}/auth/welcome`);
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
