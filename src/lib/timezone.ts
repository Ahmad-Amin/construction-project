// Each company works in one time zone (an IANA name like "Asia/Karachi"). It decides what "today"
// is, which day an event belongs to and the clock time shown beside it.
export const DEFAULT_TIMEZONE = "Asia/Karachi";

// The zones offered on the setup and settings screens. Any valid zone is accepted and kept; this
// is only the menu, so a company set up elsewhere still shows its own zone.
export const TIMEZONES = [
  { id: "Asia/Karachi", label: "Pakistan: Karachi, Lahore, Islamabad" },
  { id: "Asia/Dubai", label: "UAE: Dubai, Abu Dhabi" },
  { id: "Asia/Riyadh", label: "Saudi Arabia: Riyadh, Jeddah" },
  { id: "Asia/Qatar", label: "Qatar: Doha" },
  { id: "Asia/Kuwait", label: "Kuwait" },
  { id: "Asia/Muscat", label: "Oman: Muscat" },
  { id: "Asia/Bahrain", label: "Bahrain" },
  { id: "Asia/Kolkata", label: "India: Mumbai, Delhi" },
  { id: "Asia/Dhaka", label: "Bangladesh: Dhaka" },
  { id: "Asia/Colombo", label: "Sri Lanka: Colombo" },
  { id: "Asia/Kathmandu", label: "Nepal: Kathmandu" },
  { id: "Asia/Kuala_Lumpur", label: "Malaysia: Kuala Lumpur" },
  { id: "Asia/Singapore", label: "Singapore" },
  { id: "Africa/Cairo", label: "Egypt: Cairo" },
  { id: "Europe/Istanbul", label: "Turkey: Istanbul" },
  { id: "Africa/Lagos", label: "Nigeria: Lagos" },
  { id: "Africa/Nairobi", label: "Kenya: Nairobi" },
  { id: "Africa/Johannesburg", label: "South Africa: Johannesburg" },
  { id: "Europe/London", label: "United Kingdom: London" },
  { id: "Europe/Dublin", label: "Ireland: Dublin" },
  { id: "Europe/Paris", label: "Central Europe: Paris, Berlin, Rome" },
  { id: "Europe/Athens", label: "Eastern Europe: Athens, Helsinki" },
  { id: "America/New_York", label: "US and Canada: New York, Toronto" },
  { id: "America/Chicago", label: "US and Canada: Chicago" },
  { id: "America/Denver", label: "US and Canada: Denver" },
  { id: "America/Los_Angeles", label: "US and Canada: Los Angeles, Vancouver" },
  { id: "Australia/Sydney", label: "Australia: Sydney, Melbourne" },
  { id: "Australia/Perth", label: "Australia: Perth" },
] as const;

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// A stored value is always valid, but fall back rather than crash on a bad one.
export function timeZoneOrDefault(value: string | null | undefined): string {
  return isTimeZone(value) ? value : DEFAULT_TIMEZONE;
}

// The menu for a select: the usual zones, plus the current one if it isn't among them.
export function timeZoneOptions(current?: string): { value: string; label: string }[] {
  const list: { value: string; label: string }[] = TIMEZONES.map((z) => ({ value: z.id, label: z.label }));
  if (current && !list.some((z) => z.value === current)) {
    list.unshift({ value: current, label: current.replace(/_/g, " ") });
  }
  return list;
}
