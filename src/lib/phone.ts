import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

// Phone numbers are stored in the international format (+923001234567), which is what WhatsApp
// needs and works for any country. Numbers typed the old way (0300 1234567) are read as
// Pakistani unless they say otherwise.
export const DEFAULT_COUNTRY: CountryCode = "PK";

// "+923001234567" for anything that is a real number, otherwise null.
export function toE164(raw: string | null | undefined, country: CountryCode = DEFAULT_COUNTRY): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const parsed = parsePhoneNumberFromString(value, country);
  return parsed?.isValid() ? parsed.number : null;
}

// For form handling: blank is fine (the phone is optional), a filled-in number must be valid.
export function parsePhone(raw: string): { value: string | null; error?: string } {
  const value = raw.trim();
  // The picker submits just the dial code ("+92") when nothing was typed.
  if (!value || /^\+\d{1,4}$/.test(value)) return { value: null };
  const e164 = toE164(value);
  if (!e164) return { value: null, error: "Please enter a valid phone number for the selected country." };
  return { value: e164 };
}

// "+92 300 1234567" for showing to people; unknown formats are shown as they were typed.
export function formatPhone(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  const parsed = parsePhoneNumberFromString(value, DEFAULT_COUNTRY);
  return parsed?.isValid() ? parsed.formatInternational() : value;
}
