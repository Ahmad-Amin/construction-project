import Link from "next/link";
import { ArrowRight, Check, Lock, PartyPopper } from "lucide-react";
import { dismissGettingStarted } from "@/app/dashboard/actions";
import { ProgressBar } from "@/components/project-bits";
import type { GettingStarted } from "@/lib/getting-started";
import { SubmitButton } from "@/components/submit-button";
import { button } from "@/lib/ui";

// A short checklist for a new contractor: it shows what's done, highlights the next step,
// and goes away for good once they hide it.
export function GettingStartedCard({ data }: { data: GettingStarted }) {
  const percent = Math.round((data.done / data.total) * 100);

  return (
    <section aria-label="Get started" className="animate-rise rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            {data.complete && <PartyPopper className="size-5 text-data-accent" aria-hidden />}
            {data.complete ? "You're all set" : "Get started in 5 minutes"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {data.complete
              ? "You've used every part of the portal. Your clients can now follow their projects."
              : "Do these once and your client has a real project to follow."}
          </p>
        </div>
        <form action={dismissGettingStarted}>
          <SubmitButton
            pendingLabel="Hiding…"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted underline underline-offset-4 hover:text-foreground"
          >
            {data.complete ? "Hide this" : "Hide checklist"}
          </SubmitButton>
        </form>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1">
          <ProgressBar percent={percent} />
        </div>
        <span className="shrink-0 text-sm font-medium tabular-nums">
          {data.done} of {data.total}
        </span>
      </div>

      <ol className="mt-5 divide-y divide-line">
        {data.steps.map((step, i) => {
          const isNext = step.id === data.nextId;
          return (
            <li key={step.id} className={`flex items-start gap-3 py-3.5 ${isNext ? "-mx-2 rounded-xl bg-primary-soft/50 px-2" : ""}`}>
              <span
                className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  step.done
                    ? "bg-success text-white dark:text-stone-900"
                    : isNext
                      ? "bg-primary text-primary-foreground"
                      : "border border-line text-muted"
                }`}
                aria-hidden
              >
                {step.done ? <Check className="size-4" /> : i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${step.done ? "text-muted line-through decoration-muted/50" : ""}`}>
                  {step.title}
                  {step.optional && !step.done && <span className="ml-2 text-xs font-normal text-muted">optional</span>}
                </p>
                {!step.done && <p className="mt-0.5 text-sm text-muted">{step.description}</p>}
              </div>

              {!step.done && (
                <div className="shrink-0 self-center">
                  {step.href ? (
                    <Link href={step.href} className={isNext ? button("primary", "sm") : button("secondary", "sm")}>
                      {step.cta} <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <Lock className="size-3.5" aria-hidden /> {step.locked}
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
