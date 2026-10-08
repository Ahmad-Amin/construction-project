import { AuthAside } from "@/components/auth-aside";
import { Logo } from "@/components/logo";

// Centered card used by login, signup and first-run company setup.
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  aside = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  // Shows the brand panel beside the card on large screens (sign-in and sign-up).
  aside?: boolean;
}) {
  const content = (
    <>
      <div className={`mb-6 ${aside ? "lg:hidden" : ""}`}>
        <Logo />
      </div>
      <main className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl shadow-black/5 sm:p-8 min-[1536px]:max-w-lg min-[1536px]:p-10">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 mb-6 text-sm text-muted">{subtitle}</p>}
        {!subtitle && <div className="mb-6" />}
        {children}
      </main>
      {footer && <p className="mt-6 text-center text-sm text-muted">{footer}</p>}
    </>
  );

  if (aside) {
    return (
      <div className="grid min-h-full flex-1 lg:grid-cols-[1.1fr_1fr]">
        <AuthAside />
        <div className="relative flex flex-col items-center justify-center px-4 py-8">
          <div className="bg-blueprint absolute inset-0 -z-10 lg:hidden" aria-hidden />
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center px-4 py-8 sm:justify-center">
      <div className="bg-blueprint absolute inset-0 -z-10" aria-hidden />
      {content}
    </div>
  );
}
