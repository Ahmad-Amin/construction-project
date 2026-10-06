export const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

// Submitted text fields, for echoing back into the form after a failed save.
export function snapshot(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && key !== "milestone") values[key] = value;
  }
  return values;
}

// Money is whole rupees. Accepts "35,000,000" and "35000000"; blank means "not set".
export function parseAmount(
  raw: string,
  noun = "the budget",
): { value: number | null; error?: string } {
  const cleaned = raw.replace(/[,\s]/g, "");
  if (!cleaned) return { value: null };
  if (!/^\d+$/.test(cleaned) || !Number.isSafeInteger(Number(cleaned))) {
    return { value: null, error: `Please enter ${noun} as a whole number, like 35000000.` };
  }
  return { value: Number(cleaned) };
}

export const dateOrNull = (raw: string) => (/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null);
