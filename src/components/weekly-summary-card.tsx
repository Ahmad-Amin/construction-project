"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CalendarDays, Send } from "lucide-react";
import { sendSummaryPreview, setWeeklySummary } from "@/app/dashboard/projects/actions";
import { PreferenceToggle } from "@/components/preference-toggle";
import { formatTimestamp } from "@/lib/format";
import { button } from "@/lib/ui";

// For the owner: the weekly email the client gets on its own, with a switch to pause it and a
// preview so they can see exactly what goes out.
export function WeeklySummaryCard({
  projectId,
  clientName,
  clientJoined,
  enabled,
  companyEnabled,
  active,
  lastSentAt,
}: {
  projectId: string;
  clientName: string;
  clientJoined: boolean;
  enabled: boolean;
  companyEnabled: boolean;
  active: boolean;
  lastSentAt: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error?: string; message?: string } | null>(null);
  const firstName = clientName.trim().split(/\s+/)[0] || "Your client";

  function preview() {
    setResult(null);
    startTransition(async () => setResult(await sendSummaryPreview(projectId)));
  }

  const status = !companyEnabled
    ? "Weekly summaries are off for your company, so nothing is sent."
    : !clientJoined
    ? `Starts once ${firstName} has joined the portal.`
    : !active
      ? "Only sent while the project is active."
      : !enabled
        ? "Paused. Nothing is sent to your client."
        : lastSentAt
          ? `Last sent ${formatTimestamp(lastSentAt)}.`
          : "Goes out this Sunday evening if something happened this week.";

  return (
    <section className="animate-rise rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <CalendarDays className="size-4 text-data-accent" aria-hidden /> Weekly summary
      </h2>
      <p className="mb-4 text-sm text-muted">
        Every Sunday evening {firstName} gets one email in your company&apos;s name: progress, the week&apos;s photos
        and payments. It only ever contains what they can already see. Quiet weeks are skipped.
      </p>

      {!companyEnabled && (
        <p className="mb-4 rounded-lg bg-surface-2 px-3 py-2.5 text-sm">
          Turn it on for all your projects in{" "}
          <Link href="/dashboard/settings" className="font-semibold underline underline-offset-4">
            Settings → Client updates
          </Link>
          . You can still send yourself a preview below.
        </p>
      )}

      <PreferenceToggle
        id={`weekly-${projectId}`}
        label="Include this project"
        description={status}
        initial={enabled}
        save={(on) => setWeeklySummary(projectId, on)}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={preview} disabled={pending} className={button("secondary", "sm")}>
          <Send className="size-4" aria-hidden /> {pending ? "Sending…" : "Email me a preview"}
        </button>
        {result?.message && (
          <span role="status" className="text-sm text-success">{result.message}</span>
        )}
        {result?.error && (
          <span role="alert" className="text-sm text-danger">{result.error}</span>
        )}
      </div>
    </section>
  );
}
