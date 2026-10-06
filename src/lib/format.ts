const pkr = new Intl.NumberFormat("en-PK");

export function formatPKR(amount: number) {
  return `PKR ${pkr.format(amount)}`;
}

// "PKR 21.5M" for tiles where the full figure would crowd the layout.
export function formatPKRCompact(amount: number) {
  const abs = Math.abs(amount);
  const trim = (n: number) => String(Math.round(n * 10) / 10).replace(/\.0$/, "");
  if (abs >= 1_000_000_000) return `PKR ${trim(amount / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `PKR ${trim(amount / 1_000_000)}M`;
  if (abs >= 1_000) return `PKR ${trim(amount / 1_000)}K`;
  return `PKR ${amount}`;
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

// Just the time of day, in Pakistan time, like "3:42 pm".
export function formatTime(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Karachi",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// A moment in time (like when a payment was confirmed), shown in Pakistan time.
export function formatTimestamp(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Whole calendar days from today (Pakistan) to a date: positive in the future, negative in the past.
export function daysFromToday(value: string) {
  const day = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  };
  return day(value) - day(todayInKarachi());
}

// "just now", "5 min ago", "3 h ago", "Yesterday", then the date.
export function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" }));
}

// Today's calendar date (yyyy-mm-dd) in Pakistan, where the work happens.
// Computed from a fixed timezone so server and browser always agree.
export function todayInKarachi() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}

// "Today", "Yesterday", "3 days ago", then the plain date.
export function formatRelativeDate(value: string | null | undefined) {
  if (!value) return "";
  const [y, m, d] = value.split("-").map(Number);
  const then = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today.getTime() - then.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return `${days} days ago`;
  return formatDate(value);
}

// Turns a Pakistani number like 0300-1234567 into the digits wa.me expects.
export function whatsappNumber(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;
  return digits;
}
