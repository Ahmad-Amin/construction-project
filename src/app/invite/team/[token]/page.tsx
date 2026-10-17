import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { signOut } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";
import { button } from "@/lib/ui";
import { getViewer } from "@/lib/viewer";
import { acceptStaffInviteSignedIn, acceptStaffInviteWithPassword } from "./actions";

// Invitation links are personal: kept out of search engines, and the preview when one is shared says nothing about the
// person or the company.
export const metadata = { title: "Your team invitation", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Notice({ title, subtitle, action }: { title: string; subtitle: string; action?: { href: string; label: string } }) {
  return (
    <AuthShell title={title} subtitle={subtitle}>
      <Link href={action?.href ?? "/login"} className={`${button("secondary")} w-full`}>
        {action?.label ?? "Go to sign in"}
      </Link>
    </AuthShell>
  );
}

export default async function StaffInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let invite: { staff_name: string; email: string; company_name: string; status: string } | undefined;
  if (UUID.test(token)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_staff_invite", { p_token: token });
    invite = data?.[0];
  }

  if (!invite) {
    return <Notice title="Invitation not found" subtitle="This link isn't valid. Please ask the company owner to send it again." />;
  }
  if (invite.status === "accepted") {
    return <Notice title="Already set up" subtitle="This invitation has already been used." action={{ href: "/login", label: "Sign in" }} />;
  }
  if (invite.status === "revoked") {
    return <Notice title="Invitation cancelled" subtitle={`${invite.company_name} cancelled this invitation. Please ask them to send you a new one.`} />;
  }
  if (invite.status === "expired") {
    return <Notice title="This invitation has expired" subtitle={`Please ask ${invite.company_name} to send you a new link.`} />;
  }

  const viewer = await getViewer();
  const title = `Hi ${invite.staff_name}`;
  const subtitle = `${invite.company_name} has invited you to join their team.`;

  if (viewer && viewer.email.toLowerCase() === invite.email) {
    return (
      <AuthShell variant="team" title={title} subtitle={subtitle}>
        <AuthForm action={acceptStaffInviteSignedIn.bind(null, token)} fields={[]} submitLabel={`Join ${invite.company_name}`} />
      </AuthShell>
    );
  }

  if (viewer) {
    return (
      <AuthShell title="Wrong account" subtitle={`This invitation is for ${invite.email}, but you're signed in as ${viewer.email}.`}>
        <form action={signOut}>
          <button className={`${button("primary")} w-full`}>Sign out and continue</button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      variant="team"
      topLink={{ href: "/login", label: "Sign in" }}
      title={title}
      subtitle={subtitle}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-foreground underline underline-offset-4">
            Sign in
          </Link>{" "}
          first, then open this link again.
        </>
      }
    >
      <p className="-mt-2 mb-4 rounded-lg bg-surface-2 px-3 py-2 text-sm">
        <span className="text-muted">Your email: </span>
        <span className="font-medium">{invite.email}</span>
      </p>
      <AuthForm
        action={acceptStaffInviteWithPassword.bind(null, token)}
        submitLabel="Create password and join"
        fields={[{ name: "password", label: "Choose a password (8+ characters)", type: "password", autoComplete: "new-password" }]}
      />
      <p className="mt-4 text-center text-xs text-muted">
        By continuing you agree to the{" "}
        <Link href="/terms" className="font-medium underline underline-offset-4">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="font-medium underline underline-offset-4">
          Privacy policy
        </Link>
        .
      </p>
    </AuthShell>
  );
}
