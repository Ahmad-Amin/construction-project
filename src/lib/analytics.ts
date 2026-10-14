// Google Analytics is off unless NEXT_PUBLIC_GA_ID is set to a measurement ID like G-ABC123XYZ4 (from
// Google Analytics: Admin > Data streams > your web stream). The value is checked for shape because it
// is placed inside a script.
const raw = (process.env.NEXT_PUBLIC_GA_ID ?? "").trim();
export const GA_ID = /^G-[A-Z0-9]{6,20}$/.test(raw) ? raw : "";

// The only pages it may run on. Never the dashboard, never invite links (their address holds a private
// token) and never the sign-in callbacks.
export const ANALYTICS_PAGES = ["/", "/pricing", "/privacy", "/terms", "/trust", "/login", "/signup", "/forgot-password"];

export const CONSENT_KEY = "buildpeek-analytics";
export const CONSENT_EVENT = "buildpeek-analytics-consent";
