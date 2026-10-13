// Facts the legal and trust pages need. Set the email and operator name in .env.local
// before sharing the product: the pages read them, so there is nothing to edit in code.
export const PRODUCT_NAME = "BuildPeek";

// Who runs the service. Defaults to the product name until a legal name is set.
export const OPERATOR_NAME = process.env.NEXT_PUBLIC_OPERATOR_NAME || PRODUCT_NAME;

// Where people write to about their data. Optional, but strongly recommended.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || null;

// Whose law the Terms of use are under. Set NEXT_PUBLIC_GOVERNING_LAW (for example "England and
// Wales") to change it.
export const GOVERNING_LAW = process.env.NEXT_PUBLIC_GOVERNING_LAW || "Pakistan";

// Bump this whenever the privacy policy or terms change in a way people should know about.
export const LEGAL_UPDATED = "13 October 2026";

// How long we take to act on a request to delete an account's data.
export const DELETION_DAYS = 30;
