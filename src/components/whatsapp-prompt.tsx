"use client";

import { useState, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { dismissWhatsAppPrompt, enableWhatsAppFromPrompt } from "@/app/dashboard/notifications/actions";
import { Spinner } from "@/components/spinner";
import { useToast } from "@/components/toast";
import { button } from "@/lib/ui";

// Shown to a homeowner who hasn't switched on WhatsApp updates and hasn't said "not now". One tap
// turns it on (the same switch as in Settings); "Not now" hides it for good.
export function WhatsAppPrompt({ phone, companyName }: { phone: string; companyName: string }) {
  const toast = useToast();
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"on" | "later" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(kind: "on" | "later") {
    setBusy(kind);
    setError(null);
    startTransition(async () => {
      const result = await (kind === "on" ? enableWhatsAppFromPrompt() : dismissWhatsAppPrompt());
      if (result.error) {
        setError(result.error);
        setBusy(null);
        return;
      }
      if (kind === "on") toast.success("WhatsApp updates are on", "You can switch them off any time in Settings.");
      setHidden(true);
    });
  }

  if (hidden) return null;

  return (
    <section
      aria-label="WhatsApp updates"
      className="animate-rise flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <div className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
          <MessageCircle className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-semibold">Get updates on WhatsApp?</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            {companyName ? `${companyName} will` : "Your contractor will"} send you short messages on {phone} when a new site
            update is posted, a payment needs your confirmation or a stage is finished. They are updates only (replies
            aren&apos;t read), and you can switch them off in Settings at any time.
          </p>
          {error && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button type="button" disabled={pending} onClick={() => run("later")} className={button("secondary", "sm")}>
          {busy === "later" && <Spinner className="size-4" />} Not now
        </button>
        <button type="button" disabled={pending} onClick={() => run("on")} className={button("primary", "sm")}>
          {busy === "on" && <Spinner className="size-4" />} Turn on
        </button>
      </div>
    </section>
  );
}
