import { toE164 } from "@/lib/phone";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";

const grouped = new Intl.NumberFormat("en-US");

// "PKR 4,000,000": whole units, with the company's currency code in front.
export function formatMoney(amount: number, currency: string) {
  return `${currency} ${grouped.format(amount)}`;
}

// "PKR 21.5M" for tiles where the full figure would crowd the layout.
export function formatMoneyCompact(amount: number, currency: string) {
  const abs = Math.abs(amount);
  const trim = (n: number) => String(Math.round(n * 10) / 10).replace(/\.0$/, "");
  if (abs >= 1_000_000_000) return `${currency} ${trim(amount / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${currency} ${trim(amount / 1_000_000)}M`;
  if (abs >= 1_000) return `${currency} ${trim(amount / 1_000)}K`;
  return `${currency} ${amount}`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  // Dates are plain calendar days; parse them without a timezone shift.
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// The calendar day (yyyy-mm-dd) of a moment in time, in a time zone: the day a project was
// completed, or a document added.
export function dayInZone(iso: string, timeZone: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone });
}

// Today's calendar date (yyyy-mm-dd) where the work happens. Computed from a fixed time zone
// so server and browser always agree.
export function todayIn(timeZone: string) {
  return new Date().toLocaleDateString("en-CA", { timeZone });
}

// Just the time of day, like "3:42 pm", in the company's time zone.
export function formatTime(value: string | null | undefined, timeZone: string) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("en-GB", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// A moment in time (like when a payment was confirmed), in the company's time zone.
export function formatTimestamp(value: string | null | undefined, timeZone: string) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Whole calendar days from today to a date: positive in the future, negative in the past.
export function daysFromToday(value: string, timeZone: string) {
  const day = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  };
  return day(value) - day(todayIn(timeZone));
}

// "just now", "5 min ago", "3 h ago", "Yesterday", then the date.
export function timeAgo(iso: string, timeZone: string = DEFAULT_TIMEZONE) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(dayInZone(iso, timeZone));
}

// "Today", "Yesterday", "3 days ago", then the plain date. "Today" is the company's today.
export function formatRelativeDate(value: string | null | undefined, timeZone: string) {
  if (!value) return "";
  const dayNumber = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  };
  const days = dayNumber(todayIn(timeZone)) - dayNumber(value);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return `${days} days ago`;
  return formatDate(value);
}

// The digits wa.me expects (country code first, no plus). Handles international numbers and
// older Pakistani-style entries like 0300-1234567.
export function whatsappNumber(phone: string | null | undefined) {
  if (!phone) return null;
  const e164 = toE164(phone);
  if (e164) return e164.slice(1);
  // Not a number we can verify: fall back to the digits, the way it always worked.
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;
  return digits;
}
