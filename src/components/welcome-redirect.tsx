"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/spinner";
import { analyticsExpected, trackSignUp } from "@/lib/analytics";

const DONE_KEY = "buildpeek-google-signup-counted";

// Counts the new Google sign-up once (when analytics is on for this visitor), then goes to the dashboard. It waits a
// moment for Google's script to be ready, but never longer than a second and a half, and not at all when analytics is
// off for this visitor.
export function WelcomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    const go = () => router.replace("/dashboard");

    let counted = false;
    try {
      counted = window.sessionStorage.getItem(DONE_KEY) === "1";
    } catch {}
    if (counted || !analyticsExpected()) {
      go();
      return;
    }

    const started = Date.now();
    let leaving: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
      const ready = typeof (window as unknown as { gtag?: unknown }).gtag === "function";
      if (ready) {
        clearInterval(timer);
        trackSignUp("google");
        try {
          window.sessionStorage.setItem(DONE_KEY, "1");
        } catch {}
        // A moment for the event to leave the browser before the page changes.
        leaving = setTimeout(go, 400);
      } else if (Date.now() - started > 1500) {
        clearInterval(timer);
        go();
      }
    }, 100);

    return () => {
      clearInterval(timer);
      if (leaving) clearTimeout(leaving);
    };
  }, [router]);

  return <Spinner className="size-6 text-muted" />;
}
