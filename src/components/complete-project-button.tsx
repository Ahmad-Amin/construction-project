"use client";


import { useState, useTransition } from "react";
import { CheckCircle2, RotateCcw, TriangleAlert } from "lucide-react";
import { setProjectStatus } from "@/app/dashboard/projects/actions";
import { button } from "@/lib/ui";
import { useToast } from "@/components/toast";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// "Mark complete" asks first, listing any loose ends, then tells the client. "Reopen" undoes it.
export function CompleteProjectButton({
  projectId,
  projectName,
  completed,
  openStages,
  totalStages,
  pendingPayments,
  disputedPayments,
}: {
  projectId: string;
  projectName: string;
  completed: boolean;
  openStages: number;
  totalStages: number;
  pendingPayments: number;
  disputedPayments: number;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  function change(status: "active" | "completed") {
    setError(null);
    startTransition(async () => {
      const result = await setProjectStatus(projectId, status);
      if (result.error) setError(result.error);
      else {
        setConfirming(false);
        toast.success(status === "completed" ? "Project marked complete" : "Project reopened");
      }
    });
  }

  if (completed) {
    return (
      <>
        <button type="button" onClick={() => change("active")} disabled={pending} className={button("secondary", "sm")}>
          <RotateCcw className="size-4" aria-hidden /> {pending ? "Reopening…" : "Reopen project"}
        </button>
        {error && <span role="alert" className="basis-full text-sm text-danger">{error}</span>}
      </>
    );
  }

  const looseEnds = [
    openStages > 0 ? `${openStages} of ${plural(totalStages, "stage")} ${openStages === 1 ? "isn't" : "aren't"} at 100% yet` : null,
    pendingPayments > 0 ? `${plural(pendingPayments, "payment")} still awaiting confirmation` : null,
    disputedPayments > 0 ? `${plural(disputedPayments, "payment")} disputed` : null,
  ].filter((x): x is string => x !== null);

  return (
    <>
      <button type="button" onClick={() => setConfirming((v) => !v)} aria-expanded={confirming} className={button("secondary", "sm")}>
        <CheckCircle2 className="size-4" aria-hidden /> Mark complete
      </button>

      {confirming && (
        <div className="animate-rise basis-full rounded-2xl border border-line bg-surface p-5">
          <h3 className="font-semibold">Mark {projectName} as complete?</h3>

          {looseEnds.length > 0 ? (
            <div className="mt-3 rounded-xl bg-primary-soft/60 p-4 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <TriangleAlert className="size-4 text-data-accent" aria-hidden /> A few loose ends
              </p>
              <ul className="mt-2 list-disc space-y-0.5 pl-9 text-muted">
                {looseEnds.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-2 text-muted">You can still complete it, and sort these out afterwards.</p>
            </div>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="size-4" aria-hidden /> Every stage is finished and every payment is agreed.
            </p>
          )}

          <p className="mt-3 text-sm text-muted">
            Your client will be told, and the project keeps its history. You can reopen it any time.
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => change("completed")} disabled={pending} className={button("primary", "sm")}>
              {pending ? "Saving…" : "Yes, mark complete"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={pending} className={button("secondary", "sm")}>
              Not yet
            </button>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        </div>
      )}
    </>
  );
}
