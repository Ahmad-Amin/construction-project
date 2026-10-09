import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { signOut } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";
import { button } from "@/lib/ui";
import { getViewer } from "@/lib/viewer";
import { acceptInviteSignedIn, acceptInviteWithPassword } from "./actions";

export const metadata = { title: "Your project invite" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let invite: { client_name: string; email: string; company_name: string; accepted: boolean } | undefined;
  if (UUID.test(token)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_invite", { p_token: token });
    invite = data?.[0];
  }

  if (!invite) {
    return (
      <AuthShell
        title="Invite not found"
        subtitle="This link isn't valid. Please ask your contractor to send it again."
      >
        <Link href="/login" className={`${button("secondary")} w-full`}>
          Go to sign in
        </Link>
      </AuthShell>
    );
  }

  if (invite.accepted) {
    return (
      <AuthShell title="Already set up" subtitle="This invite has already been used.">
        <Link href="/login" className={`${button("primary")} w-full`}>
          Sign in
        </Link>
      </AuthShell>
    );
  }

  const viewer = await getViewer();
  const title = `Hi ${invite.client_name}`;
  const subtitle = `${invite.company_name} has invited you to follow your project.`;

  if (viewer && viewer.email.toLowerCase() === invite.email) {
    return (
      <AuthShell title={title} subtitle={subtitle}>
        <AuthForm
          action={acceptInviteSignedIn.bind(null, token)}
          fields={[]}
          submitLabel="View my project"
        />
      </AuthShell>
    );
  }

  if (viewer) {
    return (
      <AuthShell
        title="Wrong account"
        subtitle={`This invite is for ${invite.email}, but you're signed in as ${viewer.email}.`}
      >
        <form action={signOut}>
          <button className={`${button("primary")} w-full`}>Sign out and continue</button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      variant="invite"
      topLink={{ href: "/login", label: "Sign in" }}
      title={title}
      subtitle={subtitle}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <p className="-mt-2 mb-4 rounded-lg bg-surface-2 px-3 py-2 text-sm">
        <span className="text-muted">Your email: </span>
        <span className="font-medium">{invite.email}</span>
      </p>
      <AuthForm
        action={acceptInviteWithPassword.bind(null, token)}
        submitLabel="Create password and continue"
        fields={[
          { name: "password", label: "Choose a password (8+ characters)", type: "password", autoComplete: "new-password" },
        ]}
      />
    </AuthShell>
  );
}
