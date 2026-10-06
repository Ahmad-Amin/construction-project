import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { CompanyBadge } from "@/components/company-badge";
import { Logo } from "@/components/logo";
import { signOut } from "@/app/login/actions";
import { isDemoEmail } from "@/lib/demo";
import { getViewer } from "@/lib/viewer";
import { button } from "@/lib/ui";

// Everything behind login lives under /dashboard. The proxy does a quick
// signed-in check; this is the real one, and it also sets up the shared header.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  return (
    <div className="min-h-full">
      {isDemoEmail(viewer.email) && (
        <p className="bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground">
          You&apos;re exploring a demo project with sample data.
        </p>
      )}
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Logo href="/dashboard" />
          <div className="flex items-center gap-2">
            {viewer.company && (
              <span className="hidden max-w-56 items-center gap-2 text-sm text-muted sm:flex">
                <CompanyBadge name={viewer.company.name} logoUrl={viewer.company.logoUrl} size="sm" />
                <span className="truncate">{viewer.company.name}</span>
              </span>
            )}
            <Link
              href="/dashboard/settings"
              aria-label="Settings"
              title="Settings"
              className="flex size-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <Settings className="size-5" aria-hidden />
            </Link>
            <form action={signOut}>
              <button className={button("secondary", "sm")}>Sign out</button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
