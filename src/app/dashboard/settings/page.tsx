import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Bell, Building2, CalendarDays, Database, KeyRound, LogOut, Palette, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { Avatar } from "@/components/avatar";
import { AuthForm } from "@/components/auth-form";
import { CompanyBadge } from "@/components/company-badge";
import { CompanyWeeklySummaryToggle } from "@/components/company-weekly-summary-toggle";
import { DataExport } from "@/components/data-export";
import { EmailToggle } from "@/components/email-toggle";
import { LogoUploader } from "@/components/logo-uploader";
import { PasswordForm } from "@/components/password-form";
import { ROLE_LABEL, roleOf } from "@/components/role-tag";
import { SettingsSection } from "@/components/settings-section";
import { SubmitButton } from "@/components/submit-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { WhatsAppToggle } from "@/components/whatsapp-toggle";
import { isDemoEmail } from "@/lib/demo";
import { formatPhone } from "@/lib/phone";
import { PlanSection } from "@/components/plan-section";
import { CURRENCIES } from "@/lib/currency";
import { canSendWhatsApp, effectivePlan } from "@/lib/plans";
import { timeZoneOptions } from "@/lib/timezone";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/types";
import { button } from "@/lib/ui";
import { getViewer } from "@/lib/viewer";
import { whatsappEnabled } from "@/lib/whatsapp-api";
import { changePassword, updateCompany, updateProfile } from "./actions";

export const metadata = { title: "Settings" };

const chip = "rounded-full bg-surface/80 px-3 py-1 text-xs font-medium backdrop-blur";

const currencyOptions = CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }));

const isOwnerViewer = (v: { company: { role: string } | null }) => v.company?.role === "owner";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { reset } = await searchParams;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, created_at, email_notifications, whatsapp_notifications")
    .eq("id", viewer.userId)
    .maybeSingle();

  // Whether the person has confirmed this email address (the link we sent when they signed up).
  const { data: authUser } = await supabase.auth.getUser();
  const emailVerified = !!authUser.user?.email_confirmed_at;

  const { data: companyRow } = isOwnerViewer(viewer)
    ? await supabase.from("companies").select("weekly_summary").eq("id", viewer.company!.id).maybeSingle()
    : { data: null };

  // How many projects are Active, for the plan section (the owner's own company, by row-level security).
  const { count: activeCount } = isOwnerViewer(viewer)
    ? await supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "active").is("archived_at", null)
    : { count: 0 };
  const activeProjects = activeCount ?? 0;

  // Homeowners can ask for WhatsApp updates once sending is switched on for the product.
  const showWhatsApp = !viewer.company && whatsappEnabled();
  const { data: clientRows } = showWhatsApp
    ? await supabase.from("clients").select("phone, company:companies(plan, plan_until)").eq("user_id", viewer.userId)
    : { data: null };
  const clientRow = clientRows?.[0] ?? null;
  // Automatic WhatsApp updates are part of the contractor's paid plan: offer the switch only when at least one of
  // the companies this person is a client of has one.
  const whatsappAvailable = (clientRows ?? []).some((r) => {
    const company = one(r.company as { plan: string; plan_until: string | null } | { plan: string; plan_until: string | null }[] | null);
    return canSendWhatsApp(effectivePlan(company?.plan, company?.plan_until));
  });

  const name = profile?.name ?? "";
  const isOwner = viewer.company?.role === "owner";
  const isDemo = isDemoEmail(viewer.email);
  const roleLabel = ROLE_LABEL[roleOf(isOwner, !!viewer.company)];
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : null;

  return (
    <main className="w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back
      </Link>

      {/* Who you are, at a glance. */}
      <section className="bg-hero animate-rise flex flex-col items-start gap-4 rounded-3xl border border-line p-6 sm:flex-row sm:items-center sm:p-8">
        <Avatar name={name || viewer.email} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{name || "Your account"}</h1>
          <p className="truncate text-sm text-muted">{viewer.email}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={chip}>{roleLabel}</span>
            {viewer.company && <span className={chip}>{viewer.company.name}</span>}
            {memberSince && <span className={chip}>Member since {memberSince}</span>}
            {isDemo && <span className={`${chip} text-data-accent`}>Demo account</span>}
          </div>
        </div>
      </section>

      {reset && (
        <p
          role="status"
          className="animate-rise mt-5 flex items-start gap-2 rounded-xl bg-primary-soft px-4 py-3 text-sm font-medium text-primary-hover"
        >
          <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden />
          You&apos;re signed in. Choose a new password in the Security section below.
        </p>
      )}

      <div className="mt-8 space-y-10">
        <SettingsSection
          icon={UserRound}
          title="Profile"
          description="Your name appears next to the updates, expenses and payments you add."
        >
          <AuthForm
            action={updateProfile}
            submitLabel="Save"
            fields={[
              { name: "name", label: "Your name", defaultValue: name, autoComplete: "name" },
              {
                name: "email",
                label: "Email",
                defaultValue: viewer.email,
                readOnly: true,
                badge: emailVerified ? { label: "Verified", tone: "ok" } : { label: "Not verified", tone: "warn" },
                hint: emailVerified ? undefined : "Open the confirmation email we sent to this address to verify it.",
              },
            ]}
          />
        </SettingsSection>

        <SettingsSection
          icon={Bell}
          title="Notifications"
          description="Choose whether you also get an email when something needs your attention."
        >
          <div className="space-y-5">
            <EmailToggle initial={profile?.email_notifications ?? true} />
            {showWhatsApp && (
              <WhatsAppToggle
                initial={profile?.whatsapp_notifications ?? false}
                phone={clientRow?.phone ? formatPhone(clientRow.phone) : null}
                available={whatsappAvailable}
              />
            )}
          </div>
        </SettingsSection>

        {isOwner && (
          <SettingsSection
            icon={CalendarDays}
            title="Client updates"
            description="Keep your clients informed without lifting a finger. Off until you turn it on."
          >
            <CompanyWeeklySummaryToggle initial={companyRow?.weekly_summary ?? false} />
          </SettingsSection>
        )}

        <SettingsSection
          icon={Palette}
          title="Appearance"
          description="Choose how the app looks on this device. System follows your phone or laptop."
        >
          <ThemeToggle />
        </SettingsSection>

        <SettingsSection
          icon={ShieldCheck}
          title="Security"
          description="Keep your account safe with a password only you know."
        >
          {isDemo ? (
            <p className="rounded-lg bg-surface-2 px-4 py-3 text-sm text-muted">
              This is a shared demo account, so its password can&apos;t be changed.
            </p>
          ) : (
            <PasswordForm action={changePassword} />
          )}
          <form action={signOut} className="mt-6 border-t border-line pt-5">
            <SubmitButton
              pendingLabel="Signing out…"
              icon={<LogOut className="size-4" aria-hidden />}
              className={button("secondary", "sm")}
            >
              Sign out on this device
            </SubmitButton>
          </form>
        </SettingsSection>

        {isOwner && viewer.company && (
          <SettingsSection
            icon={Building2}
            title="Company"
            description="Your company name and logo appear on every project page your clients open."
          >
            <div className="space-y-6">
              <AuthForm
                action={updateCompany}
                submitLabel="Save"
                fields={[
                  {
                    name: "name",
                    label: "Company name",
                    defaultValue: viewer.company.name,
                    autoComplete: "organization",
                  },
                  {
                    name: "currency",
                    label: "Currency",
                    defaultValue: viewer.company.currency,
                    options: currencyOptions,
                    hint: "Shown on every amount you and your clients see. Changing it only changes the label: existing amounts are not converted.",
                  },
                  {
                    name: "timezone",
                    label: "Time zone",
                    defaultValue: viewer.company.timeZone,
                    options: timeZoneOptions(viewer.company.timeZone),
                    hint: "Decides what \"today\" is and the time shown on updates and payments, for you and your clients.",
                  },
                ]}
              />

              <div className="border-t border-line pt-6">
                <p className="mb-3 text-sm font-medium">Logo</p>
                <LogoUploader
                  companyId={viewer.company.id}
                  companyName={viewer.company.name}
                  logoUrl={viewer.company.logoUrl}
                />
              </div>

              <div className="rounded-xl border border-line bg-surface-2/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">How clients see you</p>
                <div className="mt-3 flex items-center gap-3">
                  <CompanyBadge name={viewer.company.name} logoUrl={viewer.company.logoUrl} size="md" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{viewer.company.name}</p>
                    <p className="text-xs text-muted">on every project page you share</p>
                  </div>
                </div>
              </div>
            </div>
          </SettingsSection>
        )}

        {isOwner && viewer.company && (
          <SettingsSection
            id="plan"
            icon={Sparkles}
            title="Plan"
            description="What your company's plan includes, and how to move to a bigger one."
          >
            <PlanSection
              plan={viewer.company.plan}
              until={viewer.company.planUntil}
              lapsed={viewer.company.planLapsed}
              activeProjects={activeProjects}
              timeZone={viewer.company.timeZone}
            />
          </SettingsSection>
        )}

        {isOwner && (
          <SettingsSection
            icon={Database}
            title="Your data"
            description="Your records belong to you. Download them any time, and leave whenever you like."
          >
            <DataExport />
          </SettingsSection>
        )}
      </div>
    </main>
  );
}
