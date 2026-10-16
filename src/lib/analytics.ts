// Google Analytics is off unless NEXT_PUBLIC_GA_ID is set to a measurement ID like G-ABC123XYZ4 (from
// Google Analytics: Admin > Data streams > your web stream). The value is checked for shape because it
// is placed inside a script.
const raw = (process.env.NEXT_PUBLIC_GA_ID ?? "").trim();
export const GA_ID = /^G-[A-Z0-9]{6,20}$/.test(raw) ? raw : "";

// By default Google Analytics is on for everyone on the public pages, and a visitor can switch it off from the footer.
// Set NEXT_PUBLIC_GA_CONSENT=required to ask first instead: nothing is loaded until the visitor accepts a banner
// (what EU and UK rules expect from visitors there).
export const GA_REQUIRES_CONSENT = (process.env.NEXT_PUBLIC_GA_CONSENT ?? "").trim().toLowerCase() === "required";

// The only pages it may run on. Never the dashboard, never invite links (their address holds a private
// token) and never the sign-in callbacks.
export const ANALYTICS_PAGES = ["/", "/pricing", "/privacy", "/terms", "/trust", "/login", "/signup", "/forgot-password"];

// Tells Google Analytics that someone created an account (its recommended "sign_up" event). Sends nothing about the person:
// only how they signed up. Does nothing unless the Google tag is actually loaded on this page, so it follows the visitor's
// choice (opted out, or consent-first and not yet accepted) without checking it again here.
export function trackSignUp(method: "email" = "email") {
  if (typeof window === "undefined" || !GA_ID) return;
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag === "function") gtag("event", "sign_up", { method });
}

export const CONSENT_KEY = "buildpeek-analytics";
export const CONSENT_EVENT = "buildpeek-analytics-consent";
