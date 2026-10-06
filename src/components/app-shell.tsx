"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Banknote,
  Bell,
  Camera,
  ChevronRight,
  History,
  Home,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Receipt,
  Settings,
  X,
} from "lucide-react";
import { signOut } from "@/app/login/actions";
import { Avatar } from "@/components/avatar";
import { CompanyBadge } from "@/components/company-badge";
import { Logo } from "@/components/logo";
import { button } from "@/lib/ui";
import type { ProjectStatus } from "@/lib/types";

export type ShellProject = { id: string; name: string; status: ProjectStatus; awaiting: number };

export type ShellProps = {
  user: { name: string; email: string; roleLabel: string };
  company: { name: string; logoUrl: string | null } | null;
  projects: ShellProject[];
  isOwner: boolean;
  children: React.ReactNode;
};

const statusDot: Record<ProjectStatus, string> = {
  active: "bg-success",
  on_hold: "bg-primary",
  completed: "bg-muted",
};

const SECTION_LABELS: Record<string, string> = {
  timeline: "Timeline",
  progress: "Progress",
  updates: "Updates",
  expenses: "Expenses",
  payments: "Payments",
  edit: "Edit project",
  statement: "Statement",
};

// ---------------------------------------------------------------------------
// Sidebar content, shared by the fixed desktop sidebar and the phone drawer.
// ---------------------------------------------------------------------------
function Nav({
  href,
  icon: Icon,
  children,
  badge,
  active,
  indent = false,
  onNavigate,
}: {
  href: string;
  icon: typeof Home;
  children: React.ReactNode;
  badge?: number;
  active: boolean;
  indent?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        indent ? "py-1.5" : ""
      } ${
        active
          ? "bg-primary-soft text-foreground"
          : "text-muted hover:bg-surface-2 hover:text-foreground"
      }`}
    >
      {active && <span className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-primary" aria-hidden />}
      <Icon className={`size-[18px] shrink-0 ${active ? "text-data-accent" : ""}`} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {badge ? (
        <span className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function SidebarContent({
  props,
  pathname,
  onNavigate,
}: {
  props: ShellProps;
  pathname: string;
  onNavigate?: () => void;
}) {
  const { user, company, projects, isOwner } = props;
  const match = pathname.match(/^\/dashboard\/projects\/([0-9a-f-]{36})/);
  const currentId = match?.[1] ?? null;
  const base = currentId ? `/dashboard/projects/${currentId}` : "";

  const sections = [
    { href: base, label: "Overview", icon: Home, exact: true },
    { href: `${base}/timeline`, label: "Timeline", icon: History },
    { href: `${base}/progress`, label: "Progress", icon: ListChecks },
    { href: `${base}/updates`, label: "Updates", icon: Camera },
    { href: `${base}/expenses`, label: "Expenses", icon: Receipt },
    { href: `${base}/payments`, label: "Payments", icon: Banknote },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-3 pt-4">
        <Logo href="/dashboard" />
      </div>

      {company && (
        <div className="mx-3 mb-3 flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5">
          <CompanyBadge name={company.name} logoUrl={company.logoUrl} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{company.name}</p>
            <p className="text-xs text-muted">{user.roleLabel}</p>
          </div>
        </div>
      )}

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3" aria-label="Main">
        {isOwner && (
          <Link href="/dashboard/projects/new" onClick={onNavigate} className={`${button("primary", "sm")} mb-4 w-full`}>
            <Plus className="size-4" aria-hidden /> New project
          </Link>
        )}

        <div className="space-y-0.5">
          <Nav href="/dashboard" icon={LayoutDashboard} active={pathname === "/dashboard"} onNavigate={onNavigate}>
            Dashboard
          </Nav>
        </div>

        <p className="mb-1.5 mt-6 px-3 text-xs font-semibold uppercase tracking-wide text-muted">
          {company ? "Projects" : "Your projects"}
        </p>

        {projects.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted">No projects yet.</p>
        ) : (
          <ul className="space-y-0.5">
            {projects.map((p) => {
              const isCurrent = p.id === currentId;
              return (
                <li key={p.id}>
                  <Link
                    href={`/dashboard/projects/${p.id}`}
                    onClick={onNavigate}
                    aria-current={isCurrent && pathname === `/dashboard/projects/${p.id}` ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isCurrent ? "text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    <span className={`size-2 shrink-0 rounded-full ${statusDot[p.status]}`} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {p.awaiting > 0 && (
                      <span
                        title={`${p.awaiting} payment${p.awaiting === 1 ? "" : "s"} waiting for you`}
                        className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground"
                      >
                        {p.awaiting}
                      </span>
                    )}
                    <ChevronRight
                      className={`size-4 shrink-0 transition-transform ${isCurrent ? "rotate-90" : ""}`}
                      aria-hidden
                    />
                  </Link>

                  {isCurrent && (
                    <ul className="ml-[1.1rem] mt-0.5 space-y-0.5 border-l border-line pl-2.5" aria-label={`${p.name} sections`}>
                      {sections.map((s) => {
                        const active = s.exact ? pathname === s.href : pathname.startsWith(s.href);
                        return (
                          <li key={s.label}>
                            <Nav
                              href={s.href}
                              icon={s.icon}
                              active={active}
                              indent
                              onNavigate={onNavigate}
                              badge={s.label === "Payments" ? p.awaiting : undefined}
                            >
                              {s.label}
                            </Nav>
                          </li>
                        );
                      })}
                      {isOwner && (
                        <li>
                          <Nav href={`${base}/edit`} icon={Pencil} active={pathname.startsWith(`${base}/edit`)} indent onNavigate={onNavigate}>
                            Edit project
                          </Nav>
                        </li>
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className="border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Nav href="/dashboard/settings" icon={Settings} active={pathname.startsWith("/dashboard/settings")} onNavigate={onNavigate}>
          Settings
        </Nav>
        <div className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2">
          <Avatar name={user.name || user.email} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.name || "Your account"}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <form action={signOut}>
            <button
              aria-label="Sign out"
              title="Sign out"
              className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <LogOut className="size-[18px]" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Breadcrumbs for the slim desktop top bar.
// ---------------------------------------------------------------------------
function Breadcrumbs({ pathname, projects }: { pathname: string; projects: ShellProject[] }) {
  const crumbs: { label: string; href?: string }[] = [{ label: "Dashboard", href: "/dashboard" }];

  if (pathname.startsWith("/dashboard/settings")) crumbs.push({ label: "Settings" });
  else if (pathname === "/dashboard/projects/new") crumbs.push({ label: "New project" });
  else {
    const m = pathname.match(/^\/dashboard\/projects\/([0-9a-f-]{36})(?:\/([a-z]+))?(?:\/(.+))?/);
    if (m) {
      const project = projects.find((p) => p.id === m[1]);
      crumbs.push({ label: project?.name ?? "Project", href: `/dashboard/projects/${m[1]}` });
      if (m[2]) {
        const section = SECTION_LABELS[m[2]] ?? m[2];
        const deeper = m[3] ? (m[3] === "new" ? `Add ${section.toLowerCase().replace(/s$/, "")}` : "Edit") : null;
        crumbs.push({ label: section, href: deeper ? `/dashboard/projects/${m[1]}/${m[2]}` : undefined });
        if (deeper) crumbs.push({ label: deeper });
      }
    }
  }

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-sm text-muted">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
              {c.href && !last ? (
                <Link href={c.href} className="truncate hover:text-foreground">
                  {c.label}
                </Link>
              ) : (
                <span className={`truncate ${last ? "font-medium text-foreground" : ""}`} aria-current={last ? "page" : undefined}>
                  {c.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// The shell: a fixed sidebar on desktop, a slide-in drawer on phones.
// ---------------------------------------------------------------------------
export function AppShell(props: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  // Tied to the page it was opened on, so navigating closes the drawer by itself.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const closeRef = useRef<HTMLButtonElement>(null);

  const awaitingTotal = props.projects.reduce((sum, p) => sum + p.awaiting, 0);
  const firstAwaiting = props.projects.find((p) => p.awaiting > 0);

  // Other people change things too (a client records a payment, say). When you return to this
  // tab, reload the data quietly, at most every 30 seconds.
  useEffect(() => {
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 30_000) return;
      last = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenOn(null);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="min-h-full">
      <div className="lg:flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-surface lg:block">
          <SidebarContent props={props} pathname={pathname} />
        </aside>

        <div className="min-w-0 flex-1">
          {/* Phone top bar */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur lg:hidden">
            <button
              type="button"
              onClick={() => setOpenOn(pathname)}
              aria-label="Open menu"
              aria-expanded={open}
              className="-ml-2 flex size-10 items-center justify-center rounded-lg text-foreground hover:bg-surface-2"
            >
              <Menu className="size-5" aria-hidden />
            </button>
            <Logo href="/dashboard" />
            <div className="ml-auto flex items-center gap-1">
              {firstAwaiting && (
                <Link
                  href={`/dashboard/projects/${firstAwaiting.id}/payments`}
                  aria-label={`${awaitingTotal} payment${awaitingTotal === 1 ? "" : "s"} waiting for you`}
                  className="relative flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
                >
                  <Bell className="size-5" aria-hidden />
                  <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {awaitingTotal}
                  </span>
                </Link>
              )}
            </div>
          </header>

          {/* Desktop top bar */}
          <div className="sticky top-0 z-20 hidden h-14 items-center justify-between gap-4 border-b border-line bg-background/85 px-8 backdrop-blur lg:flex">
            <Breadcrumbs pathname={pathname} projects={props.projects} />
            {firstAwaiting && (
              <Link
                href={`/dashboard/projects/${firstAwaiting.id}/payments`}
                className="flex shrink-0 items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5 text-sm font-medium transition-colors hover:bg-primary/25"
              >
                <Bell className="size-4 text-data-accent" aria-hidden />
                {awaitingTotal} {awaitingTotal === 1 ? "payment" : "payments"} waiting for you
              </Link>
            )}
          </div>

          {props.children}
        </div>
      </div>

      {/* Phone drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpenOn(null)}
            className="animate-fade absolute inset-0 bg-black/55"
          />
          <div className="animate-slide-in absolute left-0 top-0 h-dvh w-[19rem] max-w-[85vw] bg-surface shadow-2xl">
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpenOn(null)}
              aria-label="Close menu"
              className="absolute right-2 top-3 z-10 flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
            >
              <X className="size-5" aria-hidden />
            </button>
            <SidebarContent props={props} pathname={pathname} onNavigate={() => setOpenOn(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
