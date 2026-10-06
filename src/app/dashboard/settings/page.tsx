import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2, Database, KeyRound, LogOut, Palette, ShieldCheck, UserRound } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { Avatar } from "@/components/avatar";
import { AuthForm } from "@/components/auth-form";
import { CompanyBadge } from "@/components/company-badge";
import { DataExport } from "@/components/data-export";
import { LogoUploader } from "@/components/logo-uploader";
import { PasswordForm } from "@/components/password-form";
import { SettingsSection } from "@/components/settings-section";
import { ThemeToggle } from "@/components/theme-toggle";
import { isDemoEmail } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { button } from "@/lib/ui";
import { getViewer } from "@/lib/viewer";
import { changePassword, updateCompanyName, updateProfile } from "./actions";

export const metadata = { title: "Settings" };

const chip = "rounded-full bg-surface/80 px-3 py-1 text-xs font-medium backdrop-blur";

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
    .select("name, created_at")
    .eq("id", viewer.userId)
    .maybeSingle();

  const name = profile?.name ?? "";
  const isOwner = viewer.company?.role === "owner";
  const isDemo = isDemoEmail(viewer.email);
  const roleLabel = isOwner ? "Owner" : viewer.company ? "Site team" : "Homeowner";
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
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
              { name: "email", label: "Email", defaultValue: viewer.email, readOnly: true },
            ]}
          />
        </SettingsSection>

        <SettingsSection
          icon={Palette}
          title="Appearance"
          description="Choose how the portal looks on this device. System follows your phone or laptop."
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
            <button className={button("secondary", "sm")}>
              <LogOut className="size-4" aria-hidden /> Sign out on this device
            </button>
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
                action={updateCompanyName}
                submitLabel="Save"
                fields={[
                  {
                    name: "name",
                    label: "Company name",
                    defaultValue: viewer.company.name,
                    autoComplete: "organization",
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
