import { WelcomeRedirect } from "@/components/welcome-redirect";
import { Logo } from "@/components/logo";

export const metadata = { title: "Setting up your account", robots: { index: false, follow: false } };

// Where someone lands for a moment right after creating their account with Google, before the dashboard.
export default function WelcomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <p className="text-lg font-semibold">Setting up your account…</p>
      <WelcomeRedirect />
    </main>
  );
}
