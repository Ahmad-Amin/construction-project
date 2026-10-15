"use client";

import Link from "next/link";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { ANALYTICS_PAGES, CONSENT_EVENT, CONSENT_KEY, GA_ID, GA_REQUIRES_CONSENT } from "@/lib/analytics";
import { button } from "@/lib/ui";

type Choice = "granted" | "denied" | null;

function subscribe(onChange: () => void) {
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(): Choice {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function setAnalyticsChoice(choice: Choice) {
  try {
    if (choice) window.localStorage.setItem(CONSENT_KEY, choice);
    else window.localStorage.removeItem(CONSENT_KEY);
  } catch {}
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

// Google's cookies start with _ga. Removing them (on every domain level they may have been set at) is part of
// taking consent back.
function clearGoogleCookies() {
  const parts = window.location.hostname.split(".");
  const domains = ["", ...parts.map((_, i) => `.${parts.slice(i).join(".")}`)];
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0].trim();
    if (!name.startsWith("_ga")) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
    }
  }
}

// What actually applies: the visitor's own choice, and when they have made none, the default: on, unless consent is
// required first.
function effective(choice: Choice): Choice {
  return choice ?? (GA_REQUIRES_CONSENT ? null : "granted");
}

// Loads Google Analytics on the public pages. By default it is on and the visitor can switch it off (footer link);
// with NEXT_PUBLIC_GA_CONSENT=required a banner asks first and nothing is requested from Google before a yes. On any
// page that isn't on the list nothing is requested from Google at all.
export function AnalyticsConsent() {
  const pathname = usePathname();
  // undefined while the server renders: nothing is drawn until the browser has read the saved choice.
  const stored = useSyncExternalStore<Choice | undefined>(subscribe, read, () => undefined);
  const choice = stored === undefined ? undefined : effective(stored);
  const onListedPage = ANALYTICS_PAGES.includes(pathname);
  const tracking = choice === "granted" && onListedPage;

  // Google's own switch: while it is on, nothing is sent, even if the script is already loaded (for example
  // after the visitor signs in and moves to the dashboard).
  useEffect(() => {
    if (!GA_ID) return;
    (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = !tracking;
    if (choice !== "granted") clearGoogleCookies();
  }, [tracking, choice]);

  if (!GA_ID || choice === undefined || !onListedPage) return null;

  return (
    <>
      {choice === "granted" && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="google-analytics" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});
gtag('config','${GA_ID}',{allow_google_signals:false,allow_ad_personalization_signals:false});`}
          </Script>
        </>
      )}

      {choice === null && (
        <div
          role="dialog"
          aria-label="Analytics cookies"
          className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-line bg-surface p-4 shadow-2xl sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-sm"
        >
          <p className="text-sm font-semibold">Can we count visits to this page?</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            We would like to use Google Analytics, which sets cookies, to see which of our public pages are useful. It
            is never used inside your account. See our{" "}
            <Link href="/privacy#cookies" className="underline underline-offset-2 hover:text-foreground">
              privacy policy
            </Link>
            .
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setAnalyticsChoice("denied")} className={`${button("secondary", "sm")} flex-1`}>
              Decline
            </button>
            <button type="button" onClick={() => setAnalyticsChoice("granted")} className={`${button("secondary", "sm")} flex-1`}>
              Accept
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// The footer link. By default it switches analytics off (or back on); when consent is required it reopens the banner.
export function CookieSettingsButton({ className = "" }: { className?: string }) {
  const stored = useSyncExternalStore<Choice | undefined>(subscribe, read, () => undefined);
  if (!GA_ID || stored === undefined) return null;

  if (GA_REQUIRES_CONSENT) {
    return (
      <button type="button" onClick={() => setAnalyticsChoice(null)} className={className}>
        Cookie settings
      </button>
    );
  }
  const on = effective(stored) === "granted";
  return (
    <button type="button" onClick={() => setAnalyticsChoice(on ? "denied" : "granted")} className={className}>
      {on ? "Turn off analytics" : "Turn on analytics"}
    </button>
  );
}
