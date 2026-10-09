import Link from "next/link";
import { AuthAside, type AuthVariant } from "@/components/auth-aside";
import { Logo } from "@/components/logo";
import { ThemeQuickToggle } from "@/components/theme-quick-toggle";

// The frame around sign-in, sign-up, invite and password reset: a header with the logo, the theme
// switch and a link to the other way in, then (on large screens) a warm panel beside the form.
// Pass no `variant` for a single plain column, used for notices like "invite not found".
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  variant,
  topLink,
  topSlot,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  variant?: AuthVariant;
  topLink?: { href: string; label: string };
  topSlot?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-[96rem] items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12 2xl:px-16">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeQuickToggle />
          {topLink && (
            <Link
              href={topLink.href}
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground sm:block"
            >
              {topLink.label}
            </Link>
          )}
          {topSlot}
        </div>
      </header>

      <div
        className={`mx-auto grid w-full max-w-[96rem] flex-1 gap-6 px-5 pb-8 sm:px-8 lg:px-12 2xl:px-16 ${
          variant ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10" : ""
        }`}
      >
        {variant && <AuthAside variant={variant} />}

        <main className="flex items-center justify-center py-6 sm:py-10">
          <div className="animate-rise w-full max-w-md">
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
            {subtitle ? <p className="mt-3 mb-8 text-lg leading-relaxed text-muted">{subtitle}</p> : <div className="mb-8" />}
            {children}
            {footer && <p className="mt-8 text-sm text-muted">{footer}</p>}
          </div>
        </main>
      </div>
    </div>
  );
}
