"use client";

import { useState, useTransition } from "react";
import { Banknote, Check, Copy, FolderLock, Link2, MessageCircle, Pencil, RefreshCw, Trash2, UserPlus, X } from "lucide-react";
import {
  getInviteLink,
  inviteStaff,
  removeStaff,
  resendInvite,
  revokeInvite,
  saveStaffAccess,
  type TeamResult,
} from "@/app/dashboard/team/actions";
import { Avatar } from "@/components/avatar";
import { Spinner } from "@/components/spinner";
import { useToast } from "@/components/toast";
import { dayInZone, formatDate } from "@/lib/format";
import type { ProjectAccess, Team, TeamInvite, TeamMember, TeamProject } from "@/lib/team";
import { button, inputClass } from "@/lib/ui";

// ---------------------------------------------------------------------------
// Access: which projects a person can open, and on which of them they also see payments.
// ---------------------------------------------------------------------------
type Access = Record<string, { on: boolean; pay: boolean }>;

const accessFrom = (projects: TeamProject[], given: ProjectAccess[]): Access =>
  Object.fromEntries(
    projects.map((p) => {
      const found = given.find((g) => g.id === p.id);
      return [p.id, { on: !!found, pay: !!found?.pay }];
    }),
  );

const projectIds = (access: Access) => Object.keys(access).filter((id) => access[id].on);
const paymentIds = (access: Access) => Object.keys(access).filter((id) => access[id].on && access[id].pay);

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

function AccessPicker({ projects, value, onChange }: { projects: TeamProject[]; value: Access; onChange: (next: Access) => void }) {
  if (projects.length === 0) {
    return (
      <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
        You have no projects yet. You can still invite them now and give access later, from this page.
      </p>
    );
  }
  const allOn = projects.every((p) => value[p.id]?.on);
  const set = (id: string, patch: Partial<{ on: boolean; pay: boolean }>) =>
    onChange({ ...value, [id]: { ...value[id], ...patch, ...(patch.on === false ? { pay: false } : {}) } });

  return (
    <fieldset>
      <div className="mb-2 flex items-end justify-between gap-3">
        <legend className="text-sm font-medium">Projects they can open</legend>
        <button
          type="button"
          onClick={() => onChange(Object.fromEntries(projects.map((p) => [p.id, { on: !allOn, pay: allOn ? false : (value[p.id]?.pay ?? false) }])))}
          className="text-xs font-semibold text-data-accent hover:underline"
        >
          {allOn ? "Clear all" : "Select all"}
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-line">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <span>Project</span>
          <span className="flex items-center gap-1.5">
            <Banknote className="size-3.5" aria-hidden /> Can see payments
          </span>
        </div>
        <ul className="max-h-72 divide-y divide-line overflow-y-auto">
          {projects.map((p) => {
            const v = value[p.id] ?? { on: false, pay: false };
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <label className="flex min-w-0 flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={v.on}
                    onChange={(e) => set(p.id, { on: e.target.checked })}
                    className="size-4 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 truncate text-sm font-medium">{p.name}</span>
                  {p.archived && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">Archived</span>}
                </label>
                <Switch checked={v.pay} disabled={!v.on} onChange={(pay) => set(p.id, { pay })} label={`Can see payments on ${p.name}`} />
              </li>
            );
          })}
        </ul>
      </div>
      <p className="mt-2 text-xs text-muted">
        They see updates, expenses, documents and progress on the projects they can open. Payments stay hidden unless you switch them on for that project.
      </p>
    </fieldset>
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
function InviteForm({ projects, companyName, onClose }: { projects: TeamProject[]; companyName: string; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [access, setAccess] = useState<Access>(() => accessFrom(projects, []));
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ link: string; name: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await inviteStaff({ name, email, projectIds: projectIds(access), paymentProjectIds: paymentIds(access) });
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
      <AccessPicker projects={projects} value={access} onChange={setAccess} />
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
          </li>
        );
      })}
    </ul>
  );
}

function MemberCard({ member, projects, timeZone }: { member: TeamMember; projects: TeamProject[]; timeZone: string }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
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
    <article className="rounded-2xl border border-line bg-surface p-5">
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
              aria-label={`Remove ${member.name}`}
              title="Remove from team"
              onClick={() => {
                if (window.confirm(`Remove ${member.name} from your team? They lose access straight away. Their past updates stay.`)) {
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
          <AccessPicker projects={projects} value={access} onChange={setAccess} />
          <ErrorLine message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className={button("secondary", "sm")}>
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => saveStaffAccess(member.userId, projectIds(access), paymentIds(access)), "Access updated", () => setEditing(false))}
              className={button("primary", "sm")}
            >
              {pending ? "Saving…" : "Save access"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
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
            onClick={() => {
              if (window.confirm(`Cancel the invitation for ${invite.name}? Their link stops working.`)) run(() => revokeInvite(invite.id), "Invitation cancelled");
            }}
            className="flex size-9 items-center justify-center rounded-lg text-danger transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      <div className="mt-4 space-y-3">
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
}: {
  team: Team;
  companyName: string;
  timeZone: string;
  // Whether the plan has a free place (the database checks again).
  canInvite: boolean;
}) {
  const [inviting, setInviting] = useState(false);
  const empty = team.members.length === 0 && team.invites.length === 0;

  return (
    <div className="space-y-6">
      {inviting ? (
        <InviteForm projects={team.projects} companyName={companyName} onClose={() => setInviting(false)} />
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
            Invite a site supervisor to post updates and photos for you. You choose which projects they can open, and whether they see payments.
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
              <MemberCard key={m.userId} member={m} projects={team.projects} timeZone={timeZone} />
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
