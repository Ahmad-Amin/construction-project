import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ConfirmEmailForm } from "@/components/confirm-email-form";
import { confirmLinkFrom } from "@/lib/auth-flow";
import { button } from "@/lib/ui";

export const metadata = { title: "Confirm your email", robots: { index: false, follow: false } };

// Where the reminder to confirm an email lands (lib/signup-reminders.ts). Unlike /auth/callback, it doesn't depend on
// the browser that signed up, so it works from any device's email app.
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const { token_hash, type } = await searchParams;
  const link = confirmLinkFrom(token_hash, type);

  if (!link) {
    return (
      <AuthShell title="This link isn't complete" subtitle="Open the button in the email again, or sign in with your email and password.">
        <Link href="/login" className={`${button("primary")} w-full`}>
          Go to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Confirm your email" subtitle="One tap and your account is ready.">
      <ConfirmEmailForm tokenHash={link.tokenHash} type={link.type} />
    </AuthShell>
  );
}
