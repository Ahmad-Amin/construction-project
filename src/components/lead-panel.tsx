"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, ArrowUp, CalendarClock, FolderPlus, Pencil, RotateCcw, Trash2, Trophy, XCircle } from "lucide-react";
import {
  addLeadNote,
  deleteLead,
  markLeadLost,
  markLeadWon,
  moveLead,
  reopenLead,
  setFollowUp,
  updateLead,
  type LeadResult,
} from "@/app/dashboard/leads/actions";
import { useConfirm } from "@/components/confirm-dialog";
import { DateField } from "@/components/date-field";
import { FormHeading } from "@/components/form-frame";
import { ContactButtons, FollowUpChip, LeadStatusBadge } from "@/components/lead-bits";
import { LeadForm } from "@/components/lead-form";
import { useToast } from "@/components/toast";
import { dayInZone, formatDate, formatMoney, formatTime, todayIn } from "@/lib/format";
import {
  addDays,
  followUpChoices,
  followUpLabel,
  initials,
  LOST_REASONS,
  lostReasonLabel,
  sourceLabel,
  stageHex,
  workTypeLabel,
  type Lead,
  type LeadEvent,
  type LeadStage,
  type LostReason,
} from "@/lib/leads";
import { formatPhone } from "@/lib/phone";
import { button, inputClass } from "@/lib/ui";

// One lead, in the slide-over panel or as a page: who they are, where they stand, the next follow-up, how it ended, and
// everything that happened. Editing the details happens right here (no separate page), so closing the panel always
// goes back to the board.

type Props = {
  lead: Lead;
  stages: LeadStage[];
  events: LeadEvent[];
  today: string;
  currency: string;
  timeZone: string;
  phoneCountry: string;
  canChange: boolean;
  isOwner: boolean;
  projectName: string | null;
};

export function LeadPanel(props: Props) {
  const { lead, stages, today, currency, canChange, isOwner } = props;
  const [editing, setEditing] = useState(false);
  const stage = stages.find((s) => s.id === lead.stageId);
  const stageName = stage?.name ?? null;

  if (editing) {
    return (
      <>
        <FormHeading>Edit {lead.name}</FormHeading>
        <LeadForm
          mode="edit"
          sheet
          action={updateLead.bind(null, lead.id)}
          stages={stages}
          currency={currency}
          phoneCountry={props.phoneCountry}
          today={today}
          onDone={() => setEditing(false)}
          initial={{
            name: lead.name,
            phone: lead.phone ?? "",
            email: lead.email ?? "",
            stage_id: lead.stageId,
            work_type: lead.workType,
            size: lead.size,
            location: lead.location,
            budget: lead.budget === null ? "" : String(lead.budget),
            source: lead.source,
            notes: lead.notes,
          }}
        />
      </>
    );
  }

  const facts: [string, React.ReactNode][] = (
    [
      ["Phone", lead.phone ? formatPhone(lead.phone) : null],
      ["Email", lead.email],
      ["Type of work", workTypeLabel(lead.workType) || null],
      ["Size", lead.size || null],
      ["Location", lead.location || null],
      ["Rough budget", lead.budget !== null ? formatMoney(lead.budget, currency) : null],
      ["Found you through", sourceLabel(lead.source) || null],
      ["Added", formatDate(lead.createdAt.slice(0, 10))],
    ] as [string, React.ReactNode][]
  ).filter(([, v]) => v !== null && v !== "");

  return (
    <div className="flex flex-col gap-5 pb-8">
      <div>
        <FormHeading>{lead.name}</FormHeading>
        <div className="-mt-3 flex flex-wrap items-center gap-2">
          <LeadStatusBadge lead={lead} stageName={stageName} color={stage ? stageHex(stage.color) : undefined} />
          {lead.status === "open" && <FollowUpChip day={lead.followUpOn} today={today} />}
        </div>
      </div>

      <ContactButtons lead={lead} withEmail />

      {canChange && lead.status === "open" && <StageAndFollowUp {...props} />}
      {canChange || lead.projectId ? <Outcome {...props} /> : null}

      <dl className="grid gap-x-6 gap-y-3 rounded-2xl border border-line bg-surface p-4 text-sm sm:grid-cols-2 sm:p-5">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs font-medium text-muted">{label}</dt>
            <dd className="mt-0.5 break-words">{value}</dd>
          </div>
        ))}
        {lead.notes && (
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-muted">Notes</dt>
            <dd className="mt-0.5 whitespace-pre-wrap break-words">{lead.notes}</dd>
          </div>
        )}
      </dl>

      {(canChange || isOwner) && (
        <div className="flex flex-wrap gap-2">
          {canChange && (
            <button type="button" onClick={() => setEditing(true)} className={button("secondary", "sm")}>
              <Pencil className="size-4" aria-hidden /> Edit details
            </button>
          )}
          {isOwner && <DeleteLead lead={lead} />}
        </div>
      )}

      <Activity {...props} />
    </div>
  );
}

// Runs one change and reports a refusal; the page refreshes itself with the saved lead.
function useLeadAction() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<LeadResult>, done?: string, after?: () => void) =>
    start(async () => {
      const result = await fn();
      if (result.error) toast.error("That didn't save", result.error);
      else {
        if (done) toast.success(done);
        after?.();
      }
    });
  return { pending, run };
}

// ---------------------------------------------------------------------------
// The stage, and when to follow up
// ---------------------------------------------------------------------------
function StageAndFollowUp({ lead, stages, today }: Props) {
  const { pending, run } = useLeadAction();
  const [day, setDay] = useState(lead.followUpOn ?? "");
  const [note, setNote] = useState(lead.followUpNote);
  const changed = day !== (lead.followUpOn ?? "") || (day !== "" && note.trim() !== lead.followUpNote);

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-5" aria-label="Stage and follow-up">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Stage</span>
        <select value={lead.stageId} disabled={pending} onChange={(e) => run(() => moveLead(lead.id, e.target.value), "Moved")} className={inputClass}>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <CalendarClock className="size-4 text-data-accent" aria-hidden /> Follow up
          </p>
          {lead.followUpOn && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => setFollowUp(lead.id, null, ""), "Follow-up cleared", () => {
                  setDay("");
                  setNote("");
                })
              }
              className="text-xs font-semibold text-muted hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
        {lead.followUpOn && !changed && (
          <p className="text-sm text-muted">
            <span className="font-semibold text-foreground">{followUpLabel(lead.followUpOn, today)}</span>
            {lead.followUpNote ? ` · ${lead.followUpNote}` : ""}
          </p>
        )}
        <div role="group" aria-label="When to follow up" className="flex flex-wrap gap-1.5">
          {followUpChoices(today).map((c) => (
            <button
              key={c.label}
              type="button"
              aria-pressed={day === c.day}
              onClick={() => setDay(c.day)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                day === c.day ? "border-primary bg-primary-soft text-foreground" : "border-line text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <DateField value={day} onValueChange={setDay} min={today} today={today} placeholder="Or pick a day" />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            aria-label="What to do then"
            placeholder="What to do then, like 'Send the quote'"
            className={inputClass}
          />
        </div>
        {changed && day && (
          <button type="button" disabled={pending} onClick={() => run(() => setFollowUp(lead.id, day, note), "Follow-up saved")} className={button("primary", "sm")}>
            {pending ? "Saving…" : "Save follow-up"}
          </button>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// How it ends: won (and its project), lost (and why), or reopened
// ---------------------------------------------------------------------------
function Outcome({ lead, canChange, isOwner, projectName }: Props) {
  const { pending, run } = useLeadAction();
  const [choosing, setChoosing] = useState<"won" | "lost" | null>(null);
  const [reason, setReason] = useState<LostReason | null>(null);
  const newProject = `/dashboard/projects/new?lead=${lead.id}`;

  if (lead.status !== "open") {
    return (
      <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-4 sm:p-5" aria-label="Outcome">
        {lead.status === "won" && lead.projectId ? (
          <Link href={`/dashboard/projects/${lead.projectId}`} className={button("primary", "sm")}>
            Open {projectName ?? "the project"} <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : (
          lead.status === "won" &&
          isOwner && (
            <Link href={newProject} className={button("primary", "sm")}>
              <FolderPlus className="size-4" aria-hidden /> Create the project
            </Link>
          )
        )}
        {canChange && !lead.projectId && (
          <button type="button" disabled={pending} onClick={() => run(() => reopenLead(lead.id), "Reopened")} className={button("secondary", "sm")}>
            <RotateCcw className="size-4" aria-hidden /> Reopen
          </button>
        )}
      </section>
    );
  }

  if (!canChange) return null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5" aria-label="Outcome">
      {choosing === null && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-medium">Did they go ahead?</span>
          <button type="button" onClick={() => setChoosing("won")} className={button("secondary", "sm")}>
            <Trophy className="size-4 text-success" aria-hidden /> Won
          </button>
          <button type="button" onClick={() => setChoosing("lost")} className={button("secondary", "sm")}>
            <XCircle className="size-4 text-muted" aria-hidden /> Lost
          </button>
        </div>
      )}

      {choosing === "won" && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Great. {isOwner ? "Start the project now? The form is filled in from this lead." : "Mark it won."}</p>
          <div className="flex flex-wrap gap-2">
            {isOwner && (
              <Link href={newProject} className={button("primary", "sm")}>
                <FolderPlus className="size-4" aria-hidden /> Create the project
              </Link>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => markLeadWon(lead.id), "Marked won", () => setChoosing(null))}
              className={button(isOwner ? "secondary" : "primary", "sm")}
            >
              {isOwner ? "Just mark it won" : "Mark won"}
            </button>
            <button type="button" onClick={() => setChoosing(null)} className={button("ghost", "sm")}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {choosing === "lost" && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Why was it lost?</legend>
          <div className="flex flex-wrap gap-1.5">
            {LOST_REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={reason === r.id}
                onClick={() => setReason(r.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  reason === r.id ? "border-primary bg-primary-soft text-foreground" : "border-line text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !reason}
              onClick={() => reason && run(() => markLeadLost(lead.id, reason), "Marked lost", () => setChoosing(null))}
              className={button("primary", "sm")}
            >
              Mark lost
            </button>
            <button type="button" onClick={() => setChoosing(null)} className={button("ghost", "sm")}>
              Cancel
            </button>
          </div>
        </fieldset>
      )}
    </section>
  );
}

function DeleteLead({ lead }: { lead: Lead }) {
  const confirm = useConfirm();
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        const yes = await confirm({
          title: `Delete ${lead.name}?`,
          message: "The lead and its history are removed for good. To keep a record, mark it lost instead.",
          confirmLabel: "Delete",
          tone: "danger",
        });
        if (!yes) return;
        start(async () => {
          const result = await deleteLead(lead.id);
          if (result.error) toast.error("The lead wasn't deleted", result.error);
          else router.push("/dashboard/leads");
        });
      }}
      className="inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft disabled:opacity-60 sm:py-1.5"
    >
      <Trash2 className="size-4" aria-hidden /> Delete
    </button>
  );
}

// ---------------------------------------------------------------------------
// Notes and history
// ---------------------------------------------------------------------------
// What the timeline shows: notes as they were written, and the changes in one quiet line each. A run of stage moves by
// the same person on the same day is one line ("Moved Contacted → Site visit → New"), so a few drags don't bury a note.
type Entry =
  | { type: "note"; id: string; body: string; by: string | null; at: string }
  | { type: "moves"; id: string; path: string[]; by: string | null; at: string }
  | { type: "event"; id: string; kind: "created" | "won" | "lost" | "reopened" | "project"; body: string; by: string | null; at: string };

function timeline(events: LeadEvent[], timeZone: string): Entry[] {
  // Oldest first, "Added" before anything at the same moment.
  const ordered = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || (a.kind === "created" ? -1 : b.kind === "created" ? 1 : 0));
  const out: Entry[] = [];
  for (const e of ordered) {
    const last = out.at(-1);
    if (e.kind === "stage") {
      if (last?.type === "moves" && last.by === e.by && dayInZone(last.at, timeZone) === dayInZone(e.createdAt, timeZone)) {
        last.path.push(e.body);
        last.at = e.createdAt;
      } else out.push({ type: "moves", id: e.id, path: [e.body], by: e.by, at: e.createdAt });
    } else if (e.kind === "note") out.push({ type: "note", id: e.id, body: e.body, by: e.by, at: e.createdAt });
    else out.push({ type: "event", id: e.id, kind: e.kind, body: e.body, by: e.by, at: e.createdAt });
  }
  return out.reverse();
}

function Activity({ lead, events, stages, canChange, timeZone }: Props) {
  const { pending, run } = useLeadAction();
  const [note, setNote] = useState("");
  const [onlyNotes, setOnlyNotes] = useState(false);
  const all = timeline(events, timeZone);
  const notes = all.filter((e) => e.type === "note").length;
  const shown = onlyNotes ? all.filter((e) => e.type === "note") : all;

  // By day, newest first: Today, Yesterday, then the date.
  const today = todayIn(timeZone);
  const dayLabel = (day: string) => (day === today ? "Today" : day === addDays(today, -1) ? "Yesterday" : formatDate(day));
  const days: { day: string; entries: Entry[] }[] = [];
  for (const entry of shown) {
    const day = dayInZone(entry.at, timeZone);
    const group = days.at(-1);
    if (group?.day === day) group.entries.push(entry);
    else days.push({ day, entries: [entry] });
  }

  const colorOf = (stageName: string) => {
    const stage = stages.find((s) => s.name === stageName);
    return stage ? stageHex(stage.color) : "var(--line)";
  };
  const add = () => {
    if (note.trim() && !pending) run(() => addLeadNote(lead.id, note), undefined, () => setNote(""));
  };

  return (
    <section aria-labelledby="lead-activity" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id="lead-activity" className="text-sm font-semibold">
          Notes and history
        </h3>
        <div role="group" aria-label="Show" className="flex rounded-full bg-surface-2 p-0.5 text-xs font-medium">
          {[
            { on: false, label: "All" },
            { on: true, label: `Notes${notes ? ` ${notes}` : ""}` },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={onlyNotes === o.on}
              onClick={() => setOnlyNotes(o.on)}
              className={`rounded-full px-3 py-1 transition-colors ${onlyNotes === o.on ? "bg-surface text-foreground shadow-sm ring-1 ring-line" : "text-muted hover:text-foreground"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {canChange && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <div className="relative rounded-2xl border border-line bg-surface transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  add();
                }
              }}
              rows={Math.min(6, Math.max(2, note.split("\n").length))}
              maxLength={2000}
              aria-label="Add a note"
              placeholder="Add a note: called, visited the plot, sent the quote…"
              className="block max-h-48 w-full resize-none rounded-2xl bg-transparent px-4 py-3 pr-14 text-sm leading-relaxed outline-none placeholder:text-muted/70 [field-sizing:content]"
            />
            <button
              type="submit"
              disabled={pending || !note.trim()}
              aria-label="Add note"
              title="Add note"
              className="absolute bottom-2.5 right-2.5 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary-hover disabled:bg-surface-2 disabled:text-muted"
            >
              <ArrowUp className="size-4" aria-hidden />
            </button>
          </div>
          <p className={`mt-1.5 px-1 text-xs text-muted transition-opacity ${note.trim() ? "opacity-100" : "opacity-0"}`} aria-hidden={!note.trim()}>
            Press Ctrl or ⌘ + Enter to add. Only your team sees notes.
          </p>
        </form>
      )}

      {days.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          {onlyNotes ? "No notes yet. Write down what happened after each call or visit." : "Nothing here yet."}
        </p>
      ) : (
        <div className="space-y-5">
          {days.map((d) => (
            <div key={d.day}>
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{dayLabel(d.day)}</p>
              {/* The timeline's thread runs behind the dots and initials. */}
              <ol className="relative space-y-3.5 before:absolute before:bottom-3 before:left-[13.5px] before:top-3 before:w-px before:bg-line">
                {d.entries.map((e) => (
                  <li key={e.id} className="relative flex gap-3">
                    {e.type === "note" ? (
                      <>
                        <span className="z-[1] flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[10px] font-bold text-data-accent ring-4 ring-background" aria-hidden>
                          {initials(e.by ?? "?")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted">
                            <span className="font-semibold text-foreground">{e.by ?? "Someone"}</span> · {formatTime(e.at, timeZone)}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap break-words rounded-2xl rounded-tl-md bg-surface-2 px-3.5 py-2.5 text-sm leading-relaxed ring-1 ring-line">
                            {e.body}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="z-[1] flex size-7 shrink-0 items-center justify-center" aria-hidden>
                          <span
                            className="size-2.5 rounded-full ring-4 ring-background"
                            style={{
                              background:
                                e.type === "moves"
                                  ? colorOf(e.path.at(-1)!)
                                  : e.kind === "won" || e.kind === "project"
                                    ? "var(--success)"
                                    : e.kind === "created"
                                      ? "var(--primary)"
                                      : "var(--line)",
                            }}
                          />
                        </span>
                        <p className="min-w-0 flex-1 pt-1 text-sm leading-relaxed text-muted">
                          <ChangeText entry={e} />
                          <span className="whitespace-nowrap text-xs">
                            {" · "}
                            {e.by ? `${e.by} · ` : ""}
                            {formatTime(e.at, timeZone)}
                          </span>
                        </p>
                      </>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const strong = "font-semibold text-foreground";

// One change, in words: "Moved Contacted → Site visit → New", "Marked lost · Price", "Lead added".
function ChangeText({ entry }: { entry: Exclude<Entry, { type: "note" }> }) {
  if (entry.type === "moves") {
    const last = entry.path.length - 1;
    return (
      <>
        {entry.path.length === 1 ? "Moved to " : "Moved "}
        {entry.path.map((name, i) => (
          <span key={i}>
            {i > 0 && <span className="text-muted/70"> → </span>}
            <span className={i === last ? strong : ""}>{name}</span>
          </span>
        ))}
      </>
    );
  }
  switch (entry.kind) {
    case "created":
      return <>Lead added</>;
    case "won":
      return <span className={strong}>Marked won</span>;
    case "lost":
      return (
        <>
          <span className={strong}>Marked lost</span>
          {entry.body ? ` · ${lostReasonLabel(entry.body)}` : ""}
        </>
      );
    case "reopened":
      return <>Reopened</>;
    case "project":
      return (
        <>
          Project created: <span className={strong}>{entry.body}</span>
        </>
      );
  }
}
