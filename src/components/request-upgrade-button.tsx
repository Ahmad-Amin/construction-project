"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { requestPlanUpgrade } from "@/app/dashboard/settings/plan-actions";
import { Spinner } from "@/components/spinner";
import { useToast } from "@/components/toast";
import type { PlanId } from "@/lib/plans";
import { button } from "@/lib/ui";

// One tap asks for a plan: we get an email with the company and the plan, and the owner gets a
// confirmation. It can be pressed again after an hour; before that the server says so.
export function RequestUpgradeButton({
  plan,
  yearly,
  label,
  featured,
}: {
  plan: Exclude<PlanId, "free">;
  yearly: boolean;
  label: string;
  featured: boolean;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function send() {
    startTransition(async () => {
      const r = await requestPlanUpgrade(plan, yearly);
      setResult(r);
      if (r.ok) toast.success("Request sent", "We'll write to you today with the payment details.");
    });
  }

  return (
    <div className="mt-5">
      <button type="button" disabled={pending || result?.ok} onClick={send} className={`${button(featured ? "primary" : "secondary")} w-full`}>
        {pending ? <Spinner /> : result?.ok ? <Check className="size-4" aria-hidden /> : null}
        {pending ? "Sending…" : result?.ok ? "Request sent" : label}
      </button>
      {result && (
        <p role={result.ok ? "status" : "alert"} className={`mt-2 text-sm ${result.ok ? "text-muted" : "text-danger"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
