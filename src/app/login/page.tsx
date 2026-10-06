import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { DemoButtons } from "@/components/demo-buttons";
import { login, sendMagicLink } from "./actions";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to follow your project's progress, payments and updates."
      footer={
        <>
          Contractor?{" "}
          <Link href="/signup" className="font-semibold text-foreground underline underline-offset-4">
            Create your account
          </Link>
        </>
      }
    >
      {error === "demo" && (
        <p role="alert" className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          The demo isn&apos;t available right now. Please try again in a moment.
        </p>
      )}
      {error === "link" && (
        <p role="alert" className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          That sign-in link has expired. Please request a new one.
        </p>
      )}

      <AuthForm
        action={login}
        submitLabel="Sign in"
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ]}
      />

      <p className="mt-3 text-right text-sm">
        <Link href="/forgot-password" className="font-medium text-muted underline underline-offset-4 hover:text-foreground">
          Forgot your password?
        </Link>
      </p>

      <div className="my-6 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        or get a sign-in link by email
        <span className="h-px flex-1 bg-line" />
      </div>

      <AuthForm
        action={sendMagicLink}
        submitLabel="Email me a link"
        variant="secondary"
        fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]}
      />

      <div className="mt-6 border-t border-line pt-5">
        <DemoButtons />
      </div>
    </AuthShell>
  );
}
