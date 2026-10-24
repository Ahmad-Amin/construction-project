"use client";

import { useState, useTransition } from "react";
import {
  Banknote,
  Check,
  Contact,
  Copy,
  EyeOff,
  FolderLock,
  Link2,
  MessageCircle,
  PauseCircle,
  Pencil,
  PlayCircle,
  Receipt,
  RefreshCw,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import {
  getInviteLink,
  inviteStaff,
  removeStaff,
  resendInvite,
  revokeInvite,
  saveStaff,
  setStaffPaused,
  type TeamResult,
} from "@/app/dashboard/team/actions";
import { Avatar } from "@/components/avatar";
import { Spinner } from "@/components/spinner";
import { useToast } from "@/components/toast";
import { dayInZone, formatDate } from "@/lib/format";
import type { ProjectAccess, StaffSettings, Team, TeamInvite, TeamMember, TeamProject } from "@/lib/team";
import { button, inputClass } from "@/lib/ui";
import { useConfirm } from "@/components/confirm-dialog";

// ---------------------------------------------------------------------------
// Access: which projects a person can open, on which of them they also see payments, and on which they can invoice.
// ---------------------------------------------------------------------------
type Row = { on: boolean; pay: boolean; invoice: boolean };
type Access = Record<string, Row>;

const accessFrom = (projects: TeamProject[], given: ProjectAccess[]): Access =>
  Object.fromEntries(
    projects.map((p) => {
      const found = given.find((g) => g.id === p.id);
      return [p.id, { on: !!found, pay: !!found?.pay, invoice: !!found?.invoice }];
    }),
  );

const projectIds = (access: Access) => Object.keys(access).filter((id) => access[id].on);
const paymentIds = (access: Access) => Object.keys(access).filter((id) => access[id].on && access[id].pay);
const invoiceIds = (access: Access) => Object.keys(access).filter((id) => access[id].on && access[id].pay && access[id].invoice);

// Invoicing needs the client's details (they are on the invoice) and someone who isn't view-only.
const invoiceBlock = (s: StaffSettings) =>
  s.viewOnly ? "View-only staff can't send invoices." : !s.canSeeClient ? "Invoices need the client's details switched on." : null;

const NEW_STAFF: StaffSettings = { viewOnly: false, canSeeBudget: false, canSeeClient: true, canSeeLeads: false };

function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${checked ? "bg-primary" : "bg-line"}`}
    >
      <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
    </button>
  );
}

function AccessPicker({
  projects,
  value,
  onChange,
  invoices,
  invoicesBlocked,
}: {
  projects: TeamProject[];
  value: Access;
  onChange: (next: Access) => void;
  // The plan includes invoices: show the column.
  invoices: boolean;
  // Why invoices can't be switched on for this person right now (null when they can).
  invoicesBlocked: string | null;
}) {
  if (projects.length === 0) {
    return (
      <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
        You have no projects yet. You can still invite them now and give access later, from this page.
      </p>
    );
  }
  const allOn = projects.every((p) => value[p.id]?.on);
  const set = (id: string, patch: Partial<Row>) => {
    const next = { ...value[id], ...patch };
    // Switching something off switches off what depends on it.
    if (!next.on) next.pay = false;
    if (!next.pay) next.invoice = false;
    onChange({ ...value, [id]: next });
  };
  const cell = "flex w-[4.5rem] shrink-0 justify-center sm:w-24";

  return (
    <fieldset className="min-w-0">
      <div className="mb-2 flex items-end justify-between gap-3">
        <legend className="text-sm font-medium">Projects they can open</legend>
        <button
          type="button"
          onClick={() =>
            onChange(
              Object.fromEntries(
                projects.map((p) => [p.id, allOn ? { on: false, pay: false, invoice: false } : { ...(value[p.id] ?? { pay: false, invoice: false }), on: true }]),
              ),
            )
          }
          className="text-xs font-semibold text-data-accent hover:underline"
        >
          {allOn ? "Clear all" : "Select all"}
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-line">
        <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2 text-xs font-semibold text-muted sm:uppercase sm:tracking-wide">
          <span className="flex-1">Project</span>
          <span className={`${cell} items-center gap-1`}>
            <Banknote className="hidden size-3.5 sm:block" aria-hidden /> Payments
          </span>
          {invoices && (
            <span className={`${cell} items-center gap-1`}>
              <Receipt className="hidden size-3.5 sm:block" aria-hidden /> Invoices
            </span>
          )}
        </div>
        <ul className="max-h-72 divide-y divide-line overflow-y-auto">
          {projects.map((p) => {
            const v = value[p.id] ?? { on: false, pay: false, invoice: false };
            return (
              <li key={p.id} className="flex items-center gap-2 px-4 py-2.5">
                <label className="flex min-w-0 flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={v.on}
                    onChange={(e) => set(p.id, { on: e.target.checked })}
                    className="size-4 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 truncate text-sm font-medium">{p.name}</span>
                  {p.archived && <span className="hidden rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted sm:inline">Archived</span>}
                </label>
                <span className={cell}>
                  <Switch checked={v.pay} disabled={!v.on} onChange={(pay) => set(p.id, { pay })} label={`Can see payments on ${p.name}`} />
                </span>
                {invoices && (
                  <span className={cell}>
                    <Switch
                      checked={v.invoice && !invoicesBlocked}
                      disabled={!v.pay || !!invoicesBlocked}
                      onChange={(invoice) => set(p.id, { invoice })}
                      label={`Can create and send invoices on ${p.name}`}
                    />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <p className="mt-2 text-xs text-muted">
        They see updates, expenses, documents and progress on the projects they can open. Payments stay hidden unless you switch them on for that project.
        {invoices && " Invoices lets them create and send invoices on that project, and needs payments on."}
      </p>
      {invoices && invoicesBlocked && <p className="mt-1 text-xs font-medium text-primary-hover">{invoicesBlocked}</p>}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// What a person can do on every project they open.
// ---------------------------------------------------------------------------
function SettingsPicker({ value, onChange }: { value: StaffSettings; onChange: (next: StaffSettings) => void }) {
  const rows: { key: keyof StaffSettings; title: string; text: string }[] = [
    { key: "viewOnly", title: "View only", text: "They can look around, but can't post updates, add expenses or documents, or change progress." },
    { key: "canSeeBudget", title: "Can see the budget", text: "The budget of the projects they can open." },
    { key: "canSeeClient", title: "Can see the client's details", text: "The client's name, phone number and email. Invoices need this." },
    { key: "canSeeLeads", title: "Can see leads", text: "Your enquiries and their follow-ups. They get reminders for the follow-ups they set." },
  ];
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium">What they can do</legend>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="min-w-0">
              <span className="block text-sm font-medium">{r.title}</span>
              <span className="block text-xs text-muted">{r.text}</span>
            </span>
            <Switch checked={value[r.key]} onChange={(on) => onChange({ ...value, [r.key]: on })} label={r.title} />
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

// What the owner set for a person, as small tags: the limits, and leads when allowed (nothing for the usual set).
function SettingTags({ settings, paused }: { settings: StaffSettings; paused?: boolean }) {
  const tags = [
    paused && "Paused",
    settings.viewOnly && "View only",
    !settings.canSeeBudget && "Budget hidden",
    !settings.canSeeClient && "Client details hidden",
    settings.canSeeLeads && "Sees leads",
  ].filter((t): t is string => !!t);
  if (tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <li
          key={t}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${t === "Paused" ? "bg-primary-soft text-primary-hover" : "bg-surface-2 text-muted"}`}
        >
          {t === "Paused" ? (
            <PauseCircle className="size-3" aria-hidden />
          ) : t === "Sees leads" ? (
            <Contact className="size-3" aria-hidden />
          ) : (
            <EyeOff className="size-3" aria-hidden />
          )}{" "}
          {t}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// A link to send: copy it, or open WhatsApp with the message ready.
// ---------------------------------------------------------------------------
function LinkBox({ link, name, companyName, onClose }: { link: string; name: string; companyName: string; onClose?: () => void }) {
  const [copied, setCopied] = useState(false);
  const message = `Assalam o Alaikum ${name}, ${companyName} has added you to their team on BuildPeek. Open this link to set up your account: ${link}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the link is selectable in the box.
    }
  }
  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface-2/50 p-4">
      <p className="text-sm font-medium">Send {name.split(/\s+/)[0] || "them"} this private link</p>
      <input
        readOnly
        value={link}
        aria-label="Invitation link"
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-muted"
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className={button("primary", "sm")}>
          <MessageCircle className="size-4" aria-hidden /> Send on WhatsApp
        </a>
        <button type="button" onClick={copy} className={button("secondary", "sm")}>
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Copied" : "Copy link"}
        </button>
        {onClose && (
          <button type="button" onClick={onClose} className={`${button("secondary", "sm")} sm:ml-auto`}>
            Done
          </button>
        )}
      </div>
      <p className="text-xs text-muted">It works only for the email address you invited, and for 14 days.</p>
    </div>
  );
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Inviting someone
// ---------------------------------------------------------------------------
function InviteForm({
  projects,
  companyName,
  invoices,
  onClose,
}: {
  projects: TeamProject[];
  companyName: string;
  invoices: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [settings, setSettings] = useState<StaffSettings>(NEW_STAFF);
  const [access, setAccess] = useState<Access>(() => accessFrom(projects, []));
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ link: string; name: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await inviteStaff({
        name,
        email,
        settings,
        projectIds: projectIds(access),
        paymentProjectIds: paymentIds(access),
        invoiceProjectIds: invoices && !invoiceBlock(settings) ? invoiceIds(access) : [],
      });
      if (result.error || !result.link) return setError(result.error ?? "Something went wrong. Please try again.");
      setSent({ link: result.link, name: name.trim() });
    });
  }

  if (sent) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <p className="mb-4 flex items-center gap-2 font-semibold text-success">
          <Check className="size-5" aria-hidden /> Invitation created for {sent.name}
        </p>
        <LinkBox link={sent.link} name={sent.name} companyName={companyName} onClose={onClose} />
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">Invite a staff member</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} autoComplete="off" placeholder="Site supervisor's name" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" placeholder="name@example.com" className={inputClass} />
        </label>
      </div>
      <SettingsPicker value={settings} onChange={setSettings} />
      <AccessPicker projects={projects} value={access} onChange={setAccess} invoices={invoices} invoicesBlocked={invoiceBlock(settings)} />
      <ErrorLine message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={button("secondary")}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className={button("primary")}>
          {pending ? "Please wait…" : "Create invitation"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Someone on the team
// ---------------------------------------------------------------------------
function ProjectChips({ projects, given }: { projects: TeamProject[]; given: ProjectAccess[] }) {
  if (given.length === 0) {
    return (
      <p className="inline-flex items-center gap-1.5 rounded-lg bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary-hover">
        <FolderLock className="size-3.5" aria-hidden /> No projects yet: they can&apos;t see anything
      </p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {given.map((g) => {
        const p = projects.find((x) => x.id === g.id);
        if (!p) return null;
        return (
          <li key={g.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium">
            {p.name}
            {g.pay && <Banknote className="size-3.5 text-success" aria-label="can see payments" />}
            {g.invoice && <Receipt className="size-3.5 text-data-accent" aria-label="can send invoices" />}
          </li>
        );
      })}
    </ul>
  );
}

function MemberCard({
  member,
  projects,
  timeZone,
  invoices,
}: {
  member: TeamMember;
  projects: TeamProject[];
  timeZone: string;
  invoices: boolean;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [settings, setSettings] = useState<StaffSettings>(member.settings);
  const [access, setAccess] = useState<Access>(() => accessFrom(projects, member.projects));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (task: () => Promise<TeamResult>, done: string, after?: () => void) =>
    startTransition(async () => {
      const result = await task();
      if (result.error) return setError(result.error);
      setError(null);
      toast.success(done);
      after?.();
    });

  return (
    <article className={`rounded-2xl border bg-surface p-5 ${member.paused ? "border-primary/40" : "border-line"}`}>
      <div className="flex flex-wrap items-start gap-3">
        <Avatar name={member.name} size="md" />
        <div className="min-w-0 flex-1 basis-44">
          <p className="truncate font-semibold">{member.name}</p>
          <p className="truncate text-sm text-muted">{member.email}</p>
          <p className="mt-0.5 text-xs text-muted">Joined {formatDate(dayInZone(member.since, timeZone))}</p>
        </div>
        {!editing && (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setSettings(member.settings);
                setAccess(accessFrom(projects, member.projects));
                setEditing(true);
              }}
              className={button("secondary", "sm")}
            >
              <Pencil className="size-4" aria-hidden /> Edit access
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                if (member.paused) return run(() => setStaffPaused(member.userId, false), `${member.name} can use BuildPeek again`);
                if (
                  await confirm({
                    title: `Pause ${member.name}'s access?`,
                    message: "They can't open any of your projects until you resume it. Nothing is deleted, and their access comes back as it was.",
                    confirmLabel: "Pause access",
                  })
                ) {
                  run(() => setStaffPaused(member.userId, true), `${member.name}'s access is paused`);
                }
              }}
              className={button(member.paused ? "primary" : "secondary", "sm")}
            >
              {member.paused ? <PlayCircle className="size-4" aria-hidden /> : <PauseCircle className="size-4" aria-hidden />}
              {member.paused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              disabled={pending}
              aria-label={`Remove ${member.name}`}
              title="Remove from team"
              onClick={async () => {
                if (await confirm({ title: `Remove ${member.name} from your team?`, message: "They lose access straight away. Their past updates stay.", confirmLabel: "Remove", tone: "danger" })) {
                  run(() => removeStaff(member.userId), `${member.name} removed`);
                }
              }}
              className="flex size-9 items-center justify-center rounded-lg text-danger transition-colors hover:bg-surface-2 disabled:opacity-40"
            >
              {pending ? <Spinner /> : <Trash2 className="size-4" aria-hidden />}
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="mt-4 space-y-4 border-t border-line pt-4">
          <SettingsPicker value={settings} onChange={setSettings} />
          <AccessPicker projects={projects} value={access} onChange={setAccess} invoices={invoices} invoicesBlocked={invoiceBlock(settings)} />
          <ErrorLine message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className={button("secondary", "sm")}>
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    saveStaff(
                      member.userId,
                      settings,
                      projectIds(access),
                      paymentIds(access),
                      invoices && !invoiceBlock(settings) ? invoiceIds(access) : [],
                    ),
                  "Access updated",
                  () => setEditing(false),
                )
              }
              className={button("primary", "sm")}
            >
              {pending ? "Saving…" : "Save access"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {member.paused && (
            <p className="rounded-lg bg-primary-soft px-3 py-2 text-sm text-primary-hover">
              Paused: they can&apos;t open any project until you resume their access.
            </p>
          )}
          <SettingTags settings={member.settings} />
          <ProjectChips projects={projects} given={member.projects} />
          <ErrorLine message={error} />
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// An invitation that hasn't been used yet
// ---------------------------------------------------------------------------
function InviteCard({ invite, projects, companyName, timeZone }: { invite: TeamInvite; projects: TeamProject[]; companyName: string; timeZone: string }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const expired = invite.status === "expired";

  const run = (task: () => Promise<TeamResult>, done?: string, onLink?: (link: string) => void) =>
    startTransition(async () => {
      const result = await task();
      if (result.error) return setError(result.error);
      setError(null);
      if (done) toast.success(done);
      if (result.link) onLink?.(result.link);
    });

  return (
    <article className="rounded-2xl border border-dashed border-line bg-surface p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
          <Link2 className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-44">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <span className="truncate">{invite.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${expired ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary-hover"}`}>
              {expired ? "Expired" : "Waiting to join"}
            </span>
          </p>
          <p className="truncate text-sm text-muted">{invite.email}</p>
          <p className="mt-0.5 text-xs text-muted">
            {expired ? "Expired" : "Link works until"} {formatDate(dayInZone(invite.expiresAt, timeZone))}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1">
          {expired ? (
            <button type="button" disabled={pending} onClick={() => run(() => resendInvite(invite.id), undefined, setLink)} className={button("secondary", "sm")}>
              {pending ? <Spinner /> : <RefreshCw className="size-4" aria-hidden />} Send a new link
            </button>
          ) : (
            <>
              <button type="button" disabled={pending} onClick={() => run(() => getInviteLink(invite.id), undefined, setLink)} className={button("secondary", "sm")}>
                {pending ? <Spinner /> : <Link2 className="size-4" aria-hidden />} Get link
              </button>
              <button
                type="button"
                disabled={pending}
                title="A new link, and the old one stops working"
                onClick={() => run(() => resendInvite(invite.id), "New link ready", setLink)}
                className={button("secondary", "sm")}
              >
                <RefreshCw className="size-4" aria-hidden /> New link
              </button>
            </>
          )}
          <button
            type="button"
            disabled={pending}
            aria-label={`Cancel the invitation for ${invite.name}`}
            title="Cancel invitation"
            onClick={async () => {
              if (await confirm({ title: `Cancel the invitation for ${invite.name}?`, message: "Their link stops working.", confirmLabel: "Cancel invitation", cancelLabel: "Keep it", tone: "danger" })) {
                run(() => revokeInvite(invite.id), "Invitation cancelled");
              }
            }}
            className="flex size-9 items-center justify-center rounded-lg text-danger transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <SettingTags settings={invite.settings} />
        <ProjectChips projects={projects} given={invite.projects} />
        {link && <LinkBox link={link} name={invite.name} companyName={companyName} onClose={() => setLink(null)} />}
        <ErrorLine message={error} />
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// The page body
// ---------------------------------------------------------------------------
export function TeamManager({
  team,
  companyName,
  timeZone,
  canInvite,
  invoices,
}: {
  team: Team;
  companyName: string;
  timeZone: string;
  // Whether the plan has a free place (the database checks again).
  canInvite: boolean;
  // Whether the plan includes invoices (then staff can be allowed to send them).
  invoices: boolean;
}) {
  const [inviting, setInviting] = useState(false);
  const empty = team.members.length === 0 && team.invites.length === 0;

  return (
    <div className="space-y-6">
      {inviting ? (
        <InviteForm projects={team.projects} companyName={companyName} invoices={invoices} onClose={() => setInviting(false)} />
      ) : (
        canInvite && (
          <button type="button" onClick={() => setInviting(true)} className={button("primary")}>
            <UserPlus className="size-4" aria-hidden /> Invite staff
          </button>
        )
      )}

      {empty && !inviting && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <UserPlus className="size-6" aria-hidden />
          </span>
          <h3 className="mt-4 font-semibold">No staff yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Invite a site supervisor to post updates and photos for you. You choose which projects they can open, whether they see
            payments, and what else they can do.
          </p>
        </div>
      )}

      {team.members.length > 0 && (
        <section aria-label="Staff" className="space-y-3">
          <h2 className="text-sm font-semibold text-muted">
            On your team <span className="ml-1 font-normal">{team.members.length}</span>
          </h2>
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3 xl:grid-cols-2">
            {team.members.map((m) => (
              <MemberCard key={m.userId} member={m} projects={team.projects} timeZone={timeZone} invoices={invoices} />
            ))}
          </div>
        </section>
      )}

      {team.invites.length > 0 && (
        <section aria-label="Invitations" className="space-y-3">
          <h2 className="text-sm font-semibold text-muted">
            Invitations <span className="ml-1 font-normal">{team.invites.length}</span>
          </h2>
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3 xl:grid-cols-2">
            {team.invites.map((i) => (
              <InviteCard key={i.id} invite={i} projects={team.projects} companyName={companyName} timeZone={timeZone} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
