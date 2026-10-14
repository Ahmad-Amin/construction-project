"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Bug, Check, HelpCircle, Lightbulb, Mail, RotateCcw, Search, type LucideIcon } from "lucide-react";
import { setFeedbackStatus } from "@/app/dashboard/admin/feedback/actions";
import { Spinner } from "@/components/spinner";
import { useToast } from "@/components/toast";
import { button, inputClass } from "@/lib/ui";

export type FeedbackItem = {
  id: string;
  user_email: string;
  user_name: string;
  role: string;
  company_name: string;
  category: "problem" | "idea" | "question";
  message: string;
  page: string;
  browser: string;
  status: "new" | "done";
  created_at: string;
};

const KIND: Record<FeedbackItem["category"], { label: string; icon: LucideIcon; tone: string }> = {
  problem: { label: "Problem", icon: Bug, tone: "bg-danger-soft text-danger" },
  idea: { label: "Idea", icon: Lightbulb, tone: "bg-primary-soft text-primary-hover" },
  question: { label: "Question", icon: HelpCircle, tone: "bg-info-soft text-info" },
};

type Filter = "new" | "done" | "all";
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

function Row({ item }: { item: FeedbackItem }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const kind = KIND[item.category];
  const Icon = kind.icon;
  const done = item.status === "done";

  function toggle() {
    startTransition(async () => {
      const result = await setFeedbackStatus(item.id, done ? "new" : "done");
      if (!result.ok) return toast.error(result.message);
      router.refresh();
    });
  }

  const who = [item.user_name, item.user_email].filter(Boolean).join(" · ") || "unknown";
  const mailto = item.user_email
    ? `mailto:${item.user_email}?subject=${encodeURIComponent("Re: your BuildPeek feedback")}&body=${encodeURIComponent(`Hello${item.user_name ? ` ${item.user_name.split(" ")[0]}` : ""},\n\nThank you for writing. You said:\n\n> ${item.message.replace(/\n/g, "\n> ")}\n\n`)}`
    : null;

  return (
    <li className={`rounded-2xl border bg-surface p-5 ${done ? "border-line opacity-70" : "border-line"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${kind.tone}`}>
            <Icon className="size-3.5" aria-hidden /> {kind.label}
          </span>
          <p className="min-w-0 break-all text-sm font-medium">{who}</p>
        </div>
        <p className="text-xs text-muted">{when(item.created_at)}</p>
      </div>
      {(item.role || item.company_name) && (
        <p className="mt-1 text-xs capitalize text-muted">{[item.role, item.company_name].filter(Boolean).join(" · ")}</p>
      )}

      <p className="mt-3 whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed">{item.message}</p>

      <details className="mt-3 text-xs text-muted">
        <summary className="cursor-pointer select-none hover:text-foreground">Page and device</summary>
        <p className="mt-1.5 break-all">Page: {item.page || "unknown"}</p>
        <p className="mt-0.5 break-all">Device: {item.browser || "unknown"}</p>
      </details>

      <div className="mt-4 flex flex-wrap gap-2">
        {mailto && (
          <a href={mailto} className={button("secondary", "sm")}>
            <Mail className="size-4" aria-hidden /> Reply
          </a>
        )}
        <button type="button" disabled={pending} onClick={toggle} className={button(done ? "secondary" : "primary", "sm")}>
          {pending ? <Spinner className="size-4" /> : done ? <RotateCcw className="size-4" aria-hidden /> : <Check className="size-4" aria-hidden />}
          {done ? "Reopen" : "Mark done"}
        </button>
      </div>
    </li>
  );
}

// Everything people sent from inside the app, newest first. New ones first by default; the ones you have
// dealt with stay one tap away.
export function AdminFeedback({ items }: { items: FeedbackItem[] }) {
  const [filter, setFilter] = useState<Filter>("new");
  const [query, setQuery] = useState("");
  const counts = { new: items.filter((i) => i.status === "new").length, done: items.filter((i) => i.status === "done").length, all: items.length };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => (filter === "all" || i.status === filter) && (!q || `${i.message} ${i.user_email} ${i.user_name} ${i.company_name} ${i.category}`.toLowerCase().includes(q)));
  }, [items, filter, query]);

  const filters: { id: Filter; label: string }[] = [
    { id: "new", label: "New" },
    { id: "done", label: "Done" },
    { id: "all", label: "All" },
  ];

  return (
    <section aria-label="Feedback">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter feedback" className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                filter === f.id ? "border-primary bg-primary-soft text-foreground" : "border-line bg-surface text-muted hover:text-foreground"
              }`}
            >
              {f.label}
              <span className="text-xs tabular-nums text-muted">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <label className="relative block w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <span className="sr-only">Search feedback</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search message, name or company" className={`${inputClass} pl-9`} />
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
          {items.length === 0 ? "No feedback yet. When someone taps Send feedback, it appears here (and in your inbox)." : filter === "new" && !query ? "You're all caught up." : "Nothing matches."}
        </p>
      ) : (
        <ul className="mt-4 grid gap-4 xl:grid-cols-2">
          {shown.map((item) => (
            <Row key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
