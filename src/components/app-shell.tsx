"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Banknote,
  Bell,
  Camera,
  ChevronRight,
  ChevronsUpDown,
  FolderOpen,
  History,
  Home,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Pencil,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { signOut } from "@/app/login/actions";
import { Avatar } from "@/components/avatar";
import { CompanyBadge } from "@/components/company-badge";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeQuickToggle } from "@/components/theme-quick-toggle";
import { FeedbackButton } from "@/components/feedback-button";
import { TourButton, TourHost } from "@/components/tour";
import { VideoUploadIndicator } from "@/components/video-upload-indicator";
import { Logo } from "@/components/logo";
import { PlanBadge } from "@/components/plan-badge";
import type { PlanId } from "@/lib/plans";
import { LinkPending } from "@/components/link-pending";
import { RoleTag, type Role } from "@/components/role-tag";
import { SubmitButton } from "@/components/submit-button";
import { projectStatusStyle } from "@/lib/project";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";
import { button } from "@/lib/ui";
import type { ProjectStatus } from "@/lib/types";

export type ShellProject = { id: string; name: string; status: ProjectStatus; awaiting: number; archived: boolean; payments: boolean };

export type ShellProps = {
  user: { name: string; email: string; role: Role };
  company: { name: string; logoUrl: string | null } | null;
  // The company's plan and how many projects are Active, for the plan card (contractor team only).
  plan: { id: PlanId; activeProjects: number; lapsed: boolean } | null;
  projects: ShellProject[];
  isOwner: boolean;
  // Someone on the allow-list for the plans admin page (PLATFORM_ADMIN_EMAILS): they get a link to it.
  isPlatformAdmin?: boolean;
  // Notifications the person hasn't opened yet.
  unread: number;
  // Whether the person folded the desktop sidebar away (remembered in a cookie).
  initialCollapsed: boolean;
  // The guided tours this person has already been shown (kept on their account).
  toursSeen: string[];
  children: React.ReactNode;
};


const SECTION_LABELS: Record<string, string> = {
  timeline: "Timeline",
  progress: "Progress",
  updates: "Updates",
  expenses: "Expenses",
  payments: "Payments",
  documents: "Documents",
  invoices: "Invoices",
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
  collapsed = false,
  onNavigate,
}: {
  href: string;
  icon: typeof Home;
  children: React.ReactNode;
  badge?: number;
  active: boolean;
  indent?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const label = typeof children === "string" ? children : undefined;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={`group relative flex items-center rounded-lg text-sm font-medium transition-colors ${
        collapsed ? "h-10 justify-center" : `gap-3 px-3 py-2 ${indent ? "py-1.5" : ""}`
      } ${
        active
          ? "bg-primary-soft text-foreground"
          : "text-muted hover:bg-surface-2 hover:text-foreground"
      }`}
    >
      <Icon className={`size-[18px] shrink-0 ${active ? "text-data-accent" : ""}`} aria-hidden />
      <span className={collapsed ? "sr-only" : "min-w-0 flex-1 truncate"}>{children}</span>
      {collapsed ? (
        <span className="absolute right-1 top-1">
          <LinkPending className="size-3" />
        </span>
      ) : (
        <LinkPending />
      )}
      {badge ? (
        collapsed ? (
          <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-primary ring-2 ring-surface" aria-label={`${badge} waiting`} />
        ) : (
          <span className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
            {badge}
          </span>
        )
      ) : null}
    </Link>
  );
}

// The sections of one project, in the order they appear in its menu.
const PROJECT_SECTIONS = [
  { slug: "", label: "Overview", icon: Home },
  { slug: "timeline", label: "Timeline", icon: History },
  { slug: "progress", label: "Progress", icon: ListChecks },
  { slug: "updates", label: "Updates", icon: Camera },
  { slug: "expenses", label: "Expenses", icon: Receipt },
  { slug: "payments", label: "Payments", icon: Banknote },
  { slug: "documents", label: "Documents", icon: FolderOpen },
] as const;

// Sections that exist on every project, so switching projects can keep you where you are (Payments to Payments).
const SWITCHABLE = new Set(["timeline", "progress", "updates", "expenses", "payments", "invoices", "documents"]);

// How many projects the list shows before "Show all".
const SHORT_LIST = 6;

function ProjectDot({ project }: { project: ShellProject }) {
  return <span className={`size-2 shrink-0 rounded-full ${projectStatusStyle[project.archived ? "archived" : project.status].dot}`} aria-hidden />;
}

function AwaitingBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      title={`${count} payment${count === 1 ? "" : "s"} waiting for you`}
      className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground"
    >
      {count}
    </span>
  );
}

const matches = (p: ShellProject, query: string) => p.name.toLowerCase().includes(query.trim().toLowerCase());

// The current project's name, with a list to jump to another project (when there is more than one).
function ProjectSwitcher({
  current,
  projects,
  pathname,
  onNavigate,
}: {
  current: ShellProject;
  projects: ShellProject[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const others = projects.length > 1;

  useEffect(() => {
    if (!open) return;
    const onPress = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpenOn(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenOn(null);
    };
    document.addEventListener("pointerdown", onPress);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPress);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Stay on the same section of the other project when it has one; otherwise its overview.
  const segment = pathname.split("/")[4] ?? "";
  const hrefFor = (id: string) => `/dashboard/projects/${id}${SWITCHABLE.has(segment) ? `/${segment}` : ""}`;
  const live = projects.filter((p) => !p.archived && matches(p, query));
  const archived = projects.filter((p) => p.archived && matches(p, query));

  const title = (
    <>
      <ProjectDot project={current} />
      <span className="min-w-0 flex-1 truncate text-left">{current.name}</span>
    </>
  );

  if (!others) {
    return <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-sm font-semibold">{title}</div>;
  }

  const item = (p: ShellProject) => (
    <li key={p.id}>
      <Link
        href={hrefFor(p.id)}
        onClick={() => {
          setOpenOn(null);
          setQuery("");
          onNavigate?.();
        }}
        aria-current={p.id === current.id ? "page" : undefined}
        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
          p.id === current.id ? "bg-primary-soft font-semibold text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
        }`}
      >
        <ProjectDot project={p} />
        <span className="min-w-0 flex-1 truncate">{p.name}</span>
        <AwaitingBadge count={p.awaiting} />
      </Link>
    </li>
  );

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpenOn(open ? null : pathname)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Switch project"
        className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-surface-2"
      >
        {title}
        <ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 rounded-xl border border-line bg-surface p-1.5 shadow-xl shadow-black/20">
          {projects.length > SHORT_LIST && (
            <label className="relative mb-1.5 block">
              <span className="sr-only">Find a project</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a project"
                className="w-full rounded-lg border border-line bg-surface-2/60 py-1.5 pl-8 pr-2 text-sm outline-none focus:border-primary"
              />
            </label>
          )}
          <ul className="max-h-72 space-y-0.5 overflow-y-auto">
            {live.map(item)}
            {archived.length > 0 && (
              <li className="px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">Archived</li>
            )}
            {archived.map(item)}
            {live.length + archived.length === 0 && <li className="px-2.5 py-2 text-sm text-muted">No project matches.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function SidebarContent({
  props,
  pathname,
  onNavigate,
  collapsed = false,
}: {
  props: ShellProps;
  pathname: string;
  onNavigate?: () => void;
  // Icons only. Used by the desktop sidebar when the person has folded it away.
  collapsed?: boolean;
}) {
  const { user, company, plan, projects, isOwner, isPlatformAdmin } = props;
  const [showArchived, setShowArchived] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");

  // Inside a project the sidebar becomes that project's menu; everywhere else it is the main menu.
  const match = pathname.match(/^\/dashboard\/projects\/([0-9a-f-]{36})/);
  const currentId = match?.[1] ?? null;
  const current: ShellProject | null = currentId
    ? (projects.find((p) => p.id === currentId) ?? { id: currentId, name: "This project", status: "active", awaiting: 0, archived: false, payments: true })
    : null;
  const base = currentId ? `/dashboard/projects/${currentId}` : "";
  // A homeowner with a single project has nowhere else to go: no "All projects", no switcher.
  const soloHomeowner = !company && projects.length <= 1;

  const header = (
    <div className={collapsed ? "flex flex-col items-center gap-3 px-2 pb-3 pt-4" : "px-4 pb-3 pt-4"}>
      <Logo href="/dashboard" compact={collapsed} />
      {/* Its own line, so it sits under the logo rather than beside it. */}
      {collapsed ? (
        <RoleTag role={user.role} iconOnly />
      ) : (
        <div className="mt-3">
          <RoleTag role={user.role} />
        </div>
      )}
    </div>
  );

  const footer = (
    <div className={`border-t border-line pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 ${collapsed ? "px-2" : "px-3"}`}>
      <div data-tour="feedback">
        <FeedbackButton collapsed={collapsed} onNavigate={onNavigate} />
      </div>
      {isPlatformAdmin && (
        <Nav href="/dashboard/admin" icon={ShieldCheck} active={pathname.startsWith("/dashboard/admin")} collapsed={collapsed} onNavigate={onNavigate}>
          Plans admin
        </Nav>
      )}
      <div data-tour="settings">
        <Nav href="/dashboard/settings" icon={Settings} active={pathname.startsWith("/dashboard/settings")} collapsed={collapsed} onNavigate={onNavigate}>
          Settings
        </Nav>
      </div>
      <div className={collapsed ? "mt-2 flex flex-col items-center gap-1 py-1" : "mt-2 flex items-center gap-3 rounded-xl px-3 py-2"}>
        <span title={collapsed ? user.name || user.email : undefined}>
          <Avatar name={user.name || user.email} size="sm" />
        </span>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.name || "Your account"}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
        )}
        <form action={signOut}>
          <SubmitButton
            ariaLabel="Sign out"
            title="Sign out"
            icon={<LogOut className="size-[18px]" aria-hidden />}
            className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          />
        </form>
      </div>
    </div>
  );

  // ------------------------------------------------------------------ inside a project
  if (current) {
    const sections = [
      ...PROJECT_SECTIONS.filter((s) => s.slug !== "payments" || current.payments),
      ...(isOwner ? [{ slug: "edit", label: "Edit project", icon: Pencil }] : []),
    ];
    return (
      <div className="flex h-full flex-col">
        {header}
        <div className={collapsed ? "flex flex-col items-center gap-2 px-2 pb-3" : "space-y-2 px-3 pb-3"}>
          {!soloHomeowner &&
            (collapsed ? (
              <Link
                href="/dashboard"
                onClick={onNavigate}
                title="All projects"
                aria-label="All projects"
                className="flex size-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <ArrowLeft className="size-[18px]" aria-hidden />
              </Link>
            ) : (
              <Link
                href="/dashboard"
                onClick={onNavigate}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <ArrowLeft className="size-4" aria-hidden /> All projects
                <LinkPending />
              </Link>
            ))}
          {collapsed ? (
            <span
              title={current.name}
              className="relative flex size-10 items-center justify-center rounded-lg bg-surface-2 text-sm font-bold"
            >
              {current.name.trim().charAt(0).toUpperCase() || "?"}
              <span className={`absolute left-1.5 top-1.5 size-2 rounded-full ${projectStatusStyle[current.archived ? "archived" : current.status].dot}`} aria-hidden />
            </span>
          ) : (
            <ProjectSwitcher current={current} projects={projects} pathname={pathname} onNavigate={onNavigate} />
          )}
        </div>

        <nav className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-3 ${collapsed ? "px-2" : "px-3"}`} aria-label={`${current.name} sections`}>
          <ul data-tour="project-sections" className="space-y-0.5">
            {sections.map((s) => {
              const href = s.slug ? `${base}/${s.slug}` : base;
              // The Invoices tab lives inside Payments.
              const active = s.slug
                ? pathname.startsWith(href) || (s.slug === "payments" && pathname.startsWith(`${base}/invoices`))
                : pathname === base;
              return (
                <li key={s.label}>
                  <Nav
                    href={href}
                    icon={s.icon}
                    active={active}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                    badge={s.slug === "payments" ? current.awaiting : undefined}
                  >
                    {s.label}
                  </Nav>
                </li>
              );
            })}
          </ul>
        </nav>
        {footer}
      </div>
    );
  }

  // ------------------------------------------------------------------ everywhere else
  const live = projects.filter((p) => !p.archived);
  const archived = projects.filter((p) => p.archived);
  const searching = query.trim() !== "";
  const found = searching ? live.filter((p) => matches(p, query)) : live;
  const shown = searching || showAll || collapsed ? found : found.slice(0, SHORT_LIST);

  const projectLink = (p: ShellProject) =>
    collapsed ? (
      <li key={p.id}>
        <Link
          href={`/dashboard/projects/${p.id}`}
          onClick={onNavigate}
          title={p.name}
          aria-label={p.name}
          className="relative flex h-10 items-center justify-center rounded-lg text-sm font-bold text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          {p.name.trim().charAt(0).toUpperCase() || "?"}
          <span className={`absolute left-2 top-2 size-2 rounded-full ${projectStatusStyle[p.archived ? "archived" : p.status].dot}`} aria-hidden />
          {p.awaiting > 0 && <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-primary ring-2 ring-surface" />}
        </Link>
      </li>
    ) : (
      <li key={p.id}>
        <Link
          href={`/dashboard/projects/${p.id}`}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <ProjectDot project={p} />
          <span className="min-w-0 flex-1 truncate">{p.name}</span>
          <LinkPending />
          <AwaitingBadge count={p.awaiting} />
        </Link>
      </li>
    );

  return (
    <div className="flex h-full flex-col">
      {header}

      {company &&
        (collapsed ? (
          <div className="mb-3 flex justify-center" title={company.name}>
            <CompanyBadge name={company.name} logoUrl={company.logoUrl} size="md" />
          </div>
        ) : (
          <div className="mx-3 mb-3 flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5">
            <CompanyBadge name={company.name} logoUrl={company.logoUrl} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{company.name}</p>
              <p className="text-xs text-muted">Your company</p>
            </div>
          </div>
        ))}

      {plan && (
        <div data-tour="plan">
          <PlanBadge
            plan={plan.id}
            activeProjects={plan.activeProjects}
            lapsed={plan.lapsed}
            isOwner={isOwner}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        </div>
      )}

      <nav className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-3 ${collapsed ? "px-2" : "px-3"}`} aria-label="Main">
        {isOwner && (
          <Link
            href="/dashboard/projects/new"
            onClick={onNavigate}
            title={collapsed ? "New project" : undefined}
            aria-label="New project"
            data-tour="new-project"
            className={`${button("primary", "sm")} mb-4 w-full ${collapsed ? "px-0" : ""}`}
          >
            <Plus className="size-4" aria-hidden />
            {!collapsed && "New project"}
          </Link>
        )}

        <div className="space-y-0.5">
          <Nav href="/dashboard" icon={LayoutDashboard} active={pathname === "/dashboard"} collapsed={collapsed} onNavigate={onNavigate}>
            Dashboard
          </Nav>
          <Nav
            href="/dashboard/notifications"
            icon={Bell}
            active={pathname.startsWith("/dashboard/notifications")}
            badge={props.unread}
            collapsed={collapsed}
            onNavigate={onNavigate}
          >
            Notifications
          </Nav>
          {isOwner && (
            <div data-tour="team">
              <Nav href="/dashboard/team" icon={Users} active={pathname.startsWith("/dashboard/team")} collapsed={collapsed} onNavigate={onNavigate}>
                Team
              </Nav>
            </div>
          )}
        </div>

        {collapsed ? (
          <div className="my-4 border-t border-line" />
        ) : (
          <p className="mb-1.5 mt-6 flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-muted">
            {company ? "Projects" : "Your projects"}
            {live.length > 0 && <span className="font-medium tabular-nums">{live.length}</span>}
          </p>
        )}

        {!collapsed && live.length > SHORT_LIST && (
          <label className="relative mx-0.5 mb-1.5 block">
            <span className="sr-only">Find a project</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a project"
              className="w-full rounded-lg border border-line bg-surface-2/60 py-1.5 pl-8 pr-2 text-sm outline-none focus:border-primary [&::-webkit-search-cancel-button]:hidden"
            />
          </label>
        )}

        {projects.length === 0 ? (
          !collapsed && <p className="px-3 py-2 text-sm text-muted">No projects yet.</p>
        ) : (
          <ul className="space-y-0.5">
            {shown.map(projectLink)}
            {!collapsed && searching && found.length === 0 && <li className="px-3 py-2 text-sm text-muted">No project matches.</li>}
          </ul>
        )}
        {!collapsed && !searching && live.length > SHORT_LIST && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-1 w-full rounded-lg px-3 py-1.5 text-left text-sm font-medium text-data-accent transition-colors hover:bg-surface-2"
          >
            {showAll ? "Show fewer" : `Show all ${live.length}`}
          </button>
        )}

        {!collapsed && archived.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              aria-expanded={showArchived}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted hover:bg-surface-2"
            >
              <Archive className="size-3.5" aria-hidden />
              Archived ({archived.length})
              <ChevronRight className={`ml-auto size-3.5 transition-transform ${showArchived ? "rotate-90" : ""}`} aria-hidden />
            </button>
            {showArchived && <ul className="mt-0.5 space-y-0.5">{archived.map(projectLink)}</ul>}
          </div>
        )}
      </nav>

      {footer}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Breadcrumbs for the slim desktop top bar.
// ---------------------------------------------------------------------------
function Breadcrumbs({ pathname, projects }: { pathname: string; projects: ShellProject[] }) {
  const crumbs: { label: string; href?: string }[] = [{ label: "Dashboard", href: "/dashboard" }];

  if (pathname.startsWith("/dashboard/settings")) crumbs.push({ label: "Settings" });
  else if (pathname.startsWith("/dashboard/admin")) crumbs.push({ label: "Plans admin" });
  else if (pathname.startsWith("/dashboard/team")) crumbs.push({ label: "Team" });
  else if (pathname === "/dashboard/projects/new") crumbs.push({ label: "New project" });
  else {
    const m = pathname.match(/^\/dashboard\/projects\/([0-9a-f-]{36})(?:\/([a-z]+))?(?:\/(.+))?/);
    if (m) {
      const project = projects.find((p) => p.id === m[1]);
      crumbs.push({ label: project?.name ?? "Project", href: `/dashboard/projects/${m[1]}` });
      if (m[2]) {
        const section = SECTION_LABELS[m[2]] ?? m[2];
        const deeper = m[3]
          ? m[3] === "new"
            ? `Add ${section.toLowerCase().replace(/s$/, "")}`
            : m[3].endsWith("edit") || m[2] !== "invoices"
              ? "Edit"
              : "Invoice"
          : null;
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
  const [collapsed, setCollapsed] = useState(props.initialCollapsed);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    // A cookie, not local storage, so the server can draw the right width on the first paint.
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }

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
    // And once a minute while the tab stays open, so new notifications appear on their own.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
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
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 border-r border-line bg-surface transition-[width] duration-200 lg:block ${
            collapsed ? "w-[4.5rem]" : "w-64"
          }`}
        >
          <SidebarContent props={props} pathname={pathname} collapsed={collapsed} />
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
              <VideoUploadIndicator compact />
              {/* Full label on wider phones, just the icon on narrow ones, nothing on the narrowest (the menu still shows it). */}
              <span className="hidden min-[480px]:inline-flex">
                <RoleTag role={props.user.role} />
              </span>
              <span className="hidden min-[380px]:inline-flex min-[480px]:hidden">
                <RoleTag role={props.user.role} iconOnly />
              </span>
              <ThemeQuickToggle />
              <span data-tour="bell" className="inline-flex">
                <NotificationBell unread={props.unread} pathname={pathname} />
              </span>
            </div>
          </header>

          {/* Desktop top bar */}
          <div className="sticky top-0 z-20 hidden h-14 items-center justify-between gap-4 border-b border-line bg-background/85 px-8 backdrop-blur lg:flex">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                {collapsed ? <PanelLeftOpen className="size-[18px]" aria-hidden /> : <PanelLeftClose className="size-[18px]" aria-hidden />}
              </button>
              <Breadcrumbs pathname={pathname} projects={props.projects} />
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <VideoUploadIndicator />
              {firstAwaiting && (
                <Link
                  href={`/dashboard/projects/${firstAwaiting.id}/payments`}
                  className="flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5 text-sm font-medium transition-colors hover:bg-primary/25"
                >
                  {awaitingTotal} {awaitingTotal === 1 ? "payment" : "payments"} waiting for you
                </Link>
              )}
              <div className="flex items-center gap-1">
                <TourButton pathname={pathname} />
                <ThemeQuickToggle />
                <span data-tour="bell" className="inline-flex">
                  <NotificationBell unread={props.unread} pathname={pathname} />
                </span>
              </div>
            </div>
          </div>

          {props.children}
        </div>
      </div>

      <TourHost pathname={pathname} role={props.user.role} seen={props.toursSeen} />

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
