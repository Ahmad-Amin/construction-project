import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { signup } from "@/app/login/actions";

export const metadata = { title: "Create your account" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your contractor account"
      subtitle="Set up in a minute, then add your first project."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <AuthForm
        action={signup}
        submitLabel="Create account"
        fields={[
          { name: "name", label: "Your name", autoComplete: "name" },
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password (8+ characters)", type: "password", autoComplete: "new-password" },
        ]}
      />
      <p className="mt-4 text-center text-xs text-muted">
        Your data stays yours.{" "}
        <Link href="/trust" className="font-medium underline underline-offset-4">
          See how we protect it
        </Link>
      </p>
    </AuthShell>
  );
}
