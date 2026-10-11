// The currencies a company can work in. Amounts are whole units in the company's currency,
// shown as "AED 4,000,000"; nothing is ever converted.
export const CURRENCIES = [
  { code: "PKR", name: "Pakistani rupee" },
  { code: "USD", name: "US dollar" },
  { code: "AED", name: "UAE dirham" },
  { code: "SAR", name: "Saudi riyal" },
  { code: "GBP", name: "British pound" },
  { code: "EUR", name: "Euro" },
  { code: "INR", name: "Indian rupee" },
  { code: "BDT", name: "Bangladeshi taka" },
  { code: "LKR", name: "Sri Lankan rupee" },
  { code: "NPR", name: "Nepalese rupee" },
  { code: "QAR", name: "Qatari riyal" },
  { code: "KWD", name: "Kuwaiti dinar" },
  { code: "OMR", name: "Omani rial" },
  { code: "BHD", name: "Bahraini dinar" },
  { code: "EGP", name: "Egyptian pound" },
  { code: "TRY", name: "Turkish lira" },
  { code: "NGN", name: "Nigerian naira" },
  { code: "KES", name: "Kenyan shilling" },
  { code: "ZAR", name: "South African rand" },
  { code: "CAD", name: "Canadian dollar" },
  { code: "AUD", name: "Australian dollar" },
  { code: "MYR", name: "Malaysian ringgit" },
  { code: "SGD", name: "Singapore dollar" },
] as const;

export const DEFAULT_CURRENCY = "PKR";

export function isCurrency(code: unknown): code is (typeof CURRENCIES)[number]["code"] {
  return typeof code === "string" && CURRENCIES.some((c) => c.code === code);
}

// A stored value is always a valid code, but fall back rather than show "undefined".
export function currencyOrDefault(code: string | null | undefined): string {
  return code && /^[A-Z]{3}$/.test(code) ? code : DEFAULT_CURRENCY;
}

// A sensible first choice on the "Set up your company" screen, from the visitor's country
// (Vercel sends it in a header). Only a default: they can change it.
const BY_COUNTRY: Record<string, string> = {
  PK: "PKR", US: "USD", AE: "AED", SA: "SAR", GB: "GBP", IN: "INR", BD: "BDT", LK: "LKR", NP: "NPR",
  QA: "QAR", KW: "KWD", OM: "OMR", BH: "BHD", EG: "EGP", TR: "TRY", NG: "NGN", KE: "KES", ZA: "ZAR",
  CA: "CAD", AU: "AUD", MY: "MYR", SG: "SGD",
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", IE: "EUR", BE: "EUR", PT: "EUR", AT: "EUR", FI: "EUR", GR: "EUR",
};

export function currencyForCountry(country: string | null | undefined): string {
  return (country && BY_COUNTRY[country.toUpperCase()]) || DEFAULT_CURRENCY;
}
