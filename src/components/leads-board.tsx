"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { ArrowRight, BellRing, CalendarClock, ChevronDown, Contact, CornerDownRight, GripVertical, Inbox, Plus, Search, Trophy, X } from "lucide-react";
import { moveLead } from "@/app/dashboard/leads/actions";
import { ContactButtons, FollowUpChip, LeadStatusBadge } from "@/components/lead-bits";
import { useToast } from "@/components/toast";
import { formatDate, formatMoneyCompact } from "@/lib/format";
import { addDays, followUpState, initials, sourceLabel, stageHex, workTypeLabel, type Lead, type LeadStage } from "@/lib/leads";
import { button, inputClass } from "@/lib/ui";

// The leads page: open leads by stage (columns on a wide screen, a list with stage chips on a phone), the follow-ups
// in date order, and the won and lost ones. A lead moves to another stage by dragging it to that column (wide screens)
// or with "Move to" on its card (everywhere, and for keyboards). The move shows at once and is saved behind it; if the
// database refuses, the board goes back and says why.

// What a dragged card carries, so a drop from anywhere else (a link, a file) is ignored.
const DRAG_TYPE = "application/x-buildpeek-lead";

export type LeadsView = "open" | "follow-ups" | "won" | "lost";

const pill = (active: boolean) =>
  `inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? "border-primary bg-primary-soft text-foreground" : "border-line bg-surface text-muted hover:bg-surface-2 hover:text-foreground"
  }`;

export function LeadsBoard({
  leads,
  stages,
  today,
  currency,
  canChange,
  initialView,
}: {
  leads: Lead[];
  stages: LeadStage[];
  today: string;
  currency: string;
  canChange: boolean;
  initialView: LeadsView;
}) {
  const toast = useToast();
  const [view, setView] = useState<LeadsView>(initialView);
  const [query, setQuery] = useState("");
  // On a phone the open leads are one list; these chips narrow it to a stage.
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  // A moved lead goes to the top of its new column at once: the board lists the most recently changed first, so this is
  // where it will be when the saved board comes back.
  const [shown, applyMove] = useOptimistic(leads, (state, move: { id: string; stageId: string }) => {
    const moved = state.find((l) => l.id === move.id);
    return moved ? [{ ...moved, stageId: move.stageId }, ...state.filter((l) => l.id !== move.id)] : state;
  });
  const [, startTransition] = useTransition();
  // The card being dragged, and the column it is over.
  const [dragging, setDragging] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  function move(id: string, stageId: string) {
    startTransition(async () => {
      applyMove({ id, stageId });
      const result = await moveLead(id, stageId);
      if (result.error) toast.error("The lead wasn't moved", result.error);
    });
  }

  const q = query.trim().toLowerCase();
  // Numbers are saved as +923211112222; people search the way they write them, 0321 1112222. Leading zeros are dropped.
  const digits = q.replace(/\D/g, "").replace(/^0+/, "");
  const matches = (l: Lead) =>
    !q ||
    l.name.toLowerCase().includes(q) ||
    l.location.toLowerCase().includes(q) ||
    (l.email ?? "").includes(q) ||
    (digits.length >= 3 && (l.phone ?? "").replace(/\D/g, "").includes(digits));

  const open = shown.filter((l) => l.status === "open");
  const won = shown.filter((l) => l.status === "won");
  const lost = shown.filter((l) => l.status === "lost");
  const isDue = (l: Lead) => {
    const s = followUpState(l.followUpOn, today);
    return s === "overdue" || s === "today";
  };
  const due = open.filter(isDue);
  const stageName = (id: string) => stages.find((s) => s.id === id)?.name ?? null;
  const stageColor = (id: string) => {
    const stage = stages.find((s) => s.id === id);
    return stage ? stageHex(stage.color) : undefined;
  };

  const tabs: { id: LeadsView; label: string; count: number }[] = [
    { id: "open", label: "Open", count: open.length },
    { id: "follow-ups", label: "Follow-ups due", count: due.length },
    { id: "won", label: "Won", count: won.length },
    { id: "lost", label: "Lost", count: lost.length },
  ];

  const card = (l: Lead, showStage = false, drag?: DragProps) => (
    <LeadCard key={l.id} lead={l} stages={stages} stageName={stageName(l.stageId)} stageColor={stageColor(l.stageId)} showStage={showStage} today={today} currency={currency} canMove={canChange && l.status === "open"} onMove={move} drag={drag} />
  );

  // Dragging is for the board's columns. The browser's own drag and drop, so it works with a mouse and on tablets that
  // support it; "Move to" on each card does the same for everyone else.
  const dragProps = (l: Lead): DragProps | undefined =>
    canChange && l.status === "open"
      ? {
          active: dragging === l.id,
          onStart: () => setDragging(l.id),
          onEnd: () => {
            setDragging(null);
            setOverStage(null);
          },
        }
      : undefined;

  function drop(stageId: string, id: string | null) {
    setDragging(null);
    setOverStage(null);
    const lead = id ? shown.find((l) => l.id === id) : null;
    if (lead && lead.status === "open" && lead.stageId !== stageId) move(lead.id, stageId);
  }

  if (leads.length === 0) return <Welcome canChange={canChange} />;

  const filteredOpen = open.filter(matches);

  return (
    <div className="animate-rise space-y-4" style={{ animationDelay: "120ms" }}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div role="group" aria-label="Show" className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface-2/70 p-1">
          {tabs.map((t) => {
            const active = view === t.id;
            const alert = t.id === "follow-ups" && t.count > 0;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                onClick={() => setView(t.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-surface text-foreground shadow-sm ring-1 ring-line" : "text-muted hover:text-foreground"
                }`}
              >
                {t.label}
                <span
                  className={`min-w-5 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums ${
                    alert ? "bg-primary text-primary-foreground" : active ? "bg-surface-2 text-foreground" : "bg-surface-2/80 text-muted"
                  }`}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Search leads</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, phone or location"
            className={`${inputClass} rounded-full py-2 pl-9 pr-8 text-sm sm:py-2 [&::-webkit-search-cancel-button]:hidden`}
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear the search" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-surface-2 hover:text-foreground">
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </label>
      </div>

      {view === "open" && (
        <>
          {/* Wide screens: a column per stage. */}
          {canChange && filteredOpen.length > 0 && (
            <p className="hidden items-center gap-1.5 text-xs text-muted lg:flex">
              <GripVertical className="size-3.5" aria-hidden />
              Drag a lead to another column to move it, or use Move to on its card.
            </p>
          )}
          <div className="hidden auto-cols-[minmax(16rem,1fr)] grid-flow-col gap-4 overflow-x-auto pb-2 lg:grid" data-board>
            {stages.map((s) => {
              const inStage = filteredOpen.filter((l) => l.stageId === s.id);
              const value = inStage.reduce((sum, l) => sum + (l.budget ?? 0), 0);
              const over = overStage === s.id && dragging !== null;
              const tone = stageHex(s.color);
              return (
                <section
                  key={s.id}
                  aria-label={s.name}
                  data-stage={s.id}
                  onDragOver={(e) => {
                    if (!dragging || !e.dataTransfer.types.includes(DRAG_TYPE)) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (overStage !== s.id) setOverStage(s.id);
                  }}
                  onDragLeave={(e) => {
                    // Only when the pointer leaves the column, not when it crosses from one card to the next inside it.
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverStage((o) => (o === s.id ? null : o));
                  }}
                  onDrop={(e) => {
                    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
                    e.preventDefault();
                    drop(s.id, e.dataTransfer.getData(DRAG_TYPE) || dragging);
                  }}
                  className={`flex min-h-[26rem] flex-col rounded-2xl border transition-colors ${
                    over ? "border-primary bg-primary-soft ring-2 ring-inset ring-primary" : "border-line bg-surface-2/50"
                  }`}
                >
                  <header className="px-4 pb-3 pt-4">
                    <h2 className="flex items-center gap-2 text-sm font-semibold">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: tone }} aria-hidden />
                      <span className="min-w-0 truncate">{s.name}</span>
                      <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-xs font-semibold tabular-nums text-muted ring-1 ring-line">{inStage.length}</span>
                    </h2>
                    <p className="mt-1 pl-[1.125rem] text-xs text-muted">{value > 0 ? `${formatMoneyCompact(value, currency)} in rough budgets` : " "}</p>
                  </header>
                  <div className="flex flex-1 flex-col px-2.5 pb-2.5">
                    {inStage.length === 0 ? (
                      <div
                        className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center text-xs transition-colors ${
                          dragging ? "border-primary/60 text-foreground" : "border-line text-muted"
                        }`}
                      >
                        <Inbox className="size-5 opacity-60" aria-hidden />
                        {dragging ? "Drop here" : "No leads here"}
                      </div>
                    ) : (
                      <ul className="space-y-2.5">{inStage.map((l) => card(l, false, dragProps(l)))}</ul>
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Phones and tablets: one list, narrowed by stage. */}
          <div className="space-y-3 lg:hidden" data-list>
            <div role="group" aria-label="Stage" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              <button type="button" aria-pressed={stageFilter === null} onClick={() => setStageFilter(null)} className={pill(stageFilter === null)}>
                All stages <span className="text-xs tabular-nums opacity-70">{filteredOpen.length}</span>
              </button>
              {stages.map((s) => (
                <button key={s.id} type="button" aria-pressed={stageFilter === s.id} onClick={() => setStageFilter(s.id)} className={pill(stageFilter === s.id)}>
                  <span className="size-2 rounded-full" style={{ background: stageHex(s.color) }} aria-hidden />
                  {s.name} <span className="text-xs tabular-nums opacity-70">{filteredOpen.filter((l) => l.stageId === s.id).length}</span>
                </button>
              ))}
            </div>
            <LeadList empty={q ? "No open lead matches your search." : "No open leads in this stage."}>
              {filteredOpen.filter((l) => !stageFilter || l.stageId === stageFilter).map((l) => card(l, stageFilter === null))}
            </LeadList>
          </div>
        </>
      )}

      {view === "follow-ups" && <FollowUps leads={open.filter((l) => l.followUpOn && matches(l))} today={today} card={(l) => card(l, true)} />}

      {view === "won" && (
        <LeadList empty={q ? "No won lead matches your search." : "Leads you win show up here, with their project."} icon={Trophy}>
          {won.filter(matches).map((l) => card(l))}
        </LeadList>
      )}
      {view === "lost" && (
        <LeadList empty={q ? "No lost lead matches your search." : "Leads you lose show up here, with the reason."}>
          {lost.filter(matches).map((l) => card(l))}
        </LeadList>
      )}
    </div>
  );
}

// The very first visit: what leads are for, in three steps.
function Welcome({ canChange }: { canChange: boolean }) {
  const steps = [
    { icon: Contact, title: "Add every enquiry", body: "From WhatsApp, a phone call or a site visit. A name and a number is enough." },
    { icon: CalendarClock, title: "Set a follow-up", body: "Pick a day and you get a reminder that morning, in the app, by email and on WhatsApp." },
    { icon: Trophy, title: "Win it, start the project", body: "One tap turns a won lead into a project, with the client's details filled in." },
  ];
  return (
    <section className="animate-rise rounded-3xl border border-line bg-surface p-6 sm:p-8" style={{ animationDelay: "120ms" }}>
      <div className="mx-auto max-w-3xl text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-data-accent">
          <Contact className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 text-xl font-bold tracking-tight">No leads yet</h2>
        <p className="mt-1 text-sm text-muted">Keep every enquiry in one place, and never forget to call someone back.</p>
      </div>
      <ol className="mx-auto mt-7 grid max-w-4xl gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="rounded-2xl border border-line bg-surface-2/50 p-4">
            <span className="flex items-center gap-2 text-xs font-semibold text-muted">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{i + 1}</span>
              <s.icon className="size-4 text-data-accent" aria-hidden />
            </span>
            <p className="mt-3 font-semibold">{s.title}</p>
            <p className="mt-1 text-sm text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
      {canChange && (
        <div className="mt-7 text-center">
          <Link href="/dashboard/leads/new" className={button("primary")}>
            <Plus className="size-4" aria-hidden /> Add your first lead
          </Link>
        </div>
      )}
    </section>
  );
}

function LeadList({ children, empty, icon: Icon = Inbox }: { children: React.ReactNode[]; empty: string; icon?: typeof Inbox }) {
  if (children.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
        <Icon className="size-6 opacity-60" aria-hidden />
        {empty}
      </div>
    );
  }
  return <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{children}</ul>;
}

// Open leads with a follow-up, soonest first, in four groups.
function FollowUps({ leads, today, card }: { leads: Lead[]; today: string; card: (l: Lead) => React.ReactNode }) {
  const sorted = [...leads].sort((a, b) => a.followUpOn!.localeCompare(b.followUpOn!) || a.name.localeCompare(b.name));
  const weekEnd = addDays(today, 7);
  const groups = [
    { title: "Overdue", tone: "bg-danger-soft text-danger", list: sorted.filter((l) => l.followUpOn! < today) },
    { title: "Today", tone: "bg-primary text-primary-foreground", list: sorted.filter((l) => l.followUpOn === today) },
    { title: "Next 7 days", tone: "bg-surface-2 text-foreground", list: sorted.filter((l) => l.followUpOn! > today && l.followUpOn! <= weekEnd) },
    { title: "Later", tone: "bg-surface-2 text-muted", list: sorted.filter((l) => l.followUpOn! > weekEnd) },
  ].filter((g) => g.list.length > 0);
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
        <BellRing className="size-6 opacity-60" aria-hidden />
        No follow-ups set. Open a lead and choose when to get back to them.
      </div>
    );
  }
  return (
    <div className="space-y-7">
      {groups.map((g) => (
        <section key={g.title} aria-label={g.title}>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            {g.title}
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${g.tone}`}>{g.list.length}</span>
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{g.list.map(card)}</ul>
        </section>
      ))}
    </div>
  );
}

type DragProps = { active: boolean; onStart: () => void; onEnd: () => void };

function LeadCard({
  lead,
  stages,
  stageName,
  stageColor,
  showStage,
  today,
  currency,
  canMove,
  onMove,
  drag,
}: {
  lead: Lead;
  stages: LeadStage[];
  stageName: string | null;
  stageColor?: string;
  showStage: boolean;
  today: string;
  currency: string;
  canMove: boolean;
  onMove: (id: string, stageId: string) => void;
  // On the board's columns: the card can be dragged to another column.
  drag?: DragProps;
}) {
  const facts = [workTypeLabel(lead.workType), lead.size, lead.location].filter(Boolean).join(" · ") || sourceLabel(lead.source);
  const closed = lead.status !== "open";
  const others = stages.filter((s) => s.id !== lead.stageId);
  return (
    <li
      data-lead={lead.id}
      draggable={drag ? true : undefined}
      onDragStart={
        drag
          ? (e) => {
              e.dataTransfer.setData(DRAG_TYPE, lead.id);
              e.dataTransfer.effectAllowed = "move";
              drag.onStart();
            }
          : undefined
      }
      onDragEnd={drag?.onEnd}
      className={`group relative flex flex-col rounded-xl border border-line bg-surface p-3.5 shadow-sm shadow-black/[0.03] transition-[border-color,box-shadow,opacity,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md hover:shadow-black/[0.06] ${
        drag ? "cursor-grab active:cursor-grabbing" : ""
      } ${drag?.active ? "opacity-40" : ""}`}
    >
      {/* The whole card opens the lead; the buttons and "Move to" sit above this link. The link itself isn't
          draggable, so dragging the card moves the lead instead of picking up the link. */}
      <Link
        href={`/dashboard/leads/${lead.id}`}
        aria-label={`Open ${lead.name}`}
        draggable={false}
        className="absolute inset-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      />
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-data-accent ring-1 ring-primary/20" aria-hidden>
          {initials(lead.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words font-semibold leading-snug">{lead.name}</p>
          {facts && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{facts}</p>}
        </div>
      </div>

      {(lead.budget !== null || (!closed && lead.followUpOn)) && (
        <div className="mt-3 flex items-end justify-between gap-2">
          {lead.budget !== null ? (
            <p className="min-w-0">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-muted">Budget</span>
              <span className="block text-base font-semibold tabular-nums leading-tight">{formatMoneyCompact(lead.budget, currency)}</span>
            </p>
          ) : (
            <span />
          )}
          {!closed && <FollowUpChip day={lead.followUpOn} today={today} />}
        </div>
      )}

      {!closed && lead.followUpOn && lead.followUpNote && (
        <p className="mt-2.5 flex gap-1.5 rounded-lg bg-surface-2/80 px-2.5 py-1.5 text-xs text-muted">
          <CornerDownRight className="mt-px size-3.5 shrink-0" aria-hidden />
          <span className="line-clamp-2">{lead.followUpNote}</span>
        </p>
      )}

      {(showStage || closed) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <LeadStatusBadge lead={lead} stageName={stageName} color={stageColor} />
          {closed && lead.closedAt && <span className="text-xs text-muted">{formatDate(lead.closedAt.slice(0, 10))}</span>}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <ContactButtons lead={lead} compact />
        {lead.status === "won" && lead.projectId ? (
          <Link href={`/dashboard/projects/${lead.projectId}`} className="relative z-10 ml-auto inline-flex items-center gap-1 text-xs font-semibold text-data-accent hover:underline">
            Project <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        ) : (
          canMove &&
          others.length > 0 && (
            <label className="relative z-10 ml-auto">
              <span className="sr-only">Move {lead.name} to another stage</span>
              <select
                value=""
                onChange={(e) => e.target.value && onMove(lead.id, e.target.value)}
                className="cursor-pointer appearance-none rounded-full border border-transparent bg-surface-2 py-1 pl-3 pr-7 text-xs font-medium text-muted outline-none transition-colors hover:border-line hover:text-foreground focus:border-primary"
              >
                <option value="" disabled>
                  Move to…
                </option>
                {others.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
            </label>
          )
        )}
      </div>
    </li>
  );
}
