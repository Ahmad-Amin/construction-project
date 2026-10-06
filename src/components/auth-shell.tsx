import { Logo } from "@/components/logo";

// Centered card used by login, signup and first-run company setup.
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center px-4 py-8 sm:justify-center">
      <div className="bg-blueprint absolute inset-0 -z-10" aria-hidden />
      <div className="mb-6">
        <Logo />
      </div>
      <main className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-xl shadow-black/5 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 mb-6 text-sm text-muted">{subtitle}</p>}
        {!subtitle && <div className="mb-6" />}
        {children}
      </main>
      {footer && <p className="mt-6 text-center text-sm text-muted">{footer}</p>}
    </div>
  );
}
