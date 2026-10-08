import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { DemoButtons } from "@/components/demo-buttons";
import { LoginMethods } from "@/components/login-methods";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthShell
      aside
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

      <LoginMethods />

      <div className="mt-6 border-t border-line pt-5">
        <DemoButtons compact />
      </div>
    </AuthShell>
  );
}
