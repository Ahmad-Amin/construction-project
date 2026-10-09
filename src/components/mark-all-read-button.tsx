"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, CheckCheck } from "lucide-react";
import { markAllNotificationsRead } from "@/app/dashboard/notifications/actions";
import { Spinner } from "@/components/spinner";
import { useToast } from "@/components/toast";
import { button } from "@/lib/ui";

// "Mark all as read" with visible feedback: a spinner while it works, then a tick once done.
export function MarkAllReadButton({ unread }: { unread: number }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const toast = useToast();

  // The page re-renders with nothing unread as soon as the action finishes; keep the button
  // around for a moment so the "All read" tick can be seen.
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(false), 2500);
    return () => clearTimeout(timer);
  }, [done]);

  function run() {
    startTransition(async () => {
      await markAllNotificationsRead();
      setDone(true);
      toast.success("All notifications marked as read");
    });
  }

  if (unread === 0 && !done && !pending) return null;

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending || done}
      aria-busy={pending || undefined}
      className={button("secondary", "sm")}
    >
      {pending ? <Spinner /> : done ? <Check className="size-4 text-success" aria-hidden /> : <CheckCheck className="size-4" aria-hidden />}
      {pending ? "Marking…" : done ? "All read" : "Mark all as read"}
    </button>
  );
}
