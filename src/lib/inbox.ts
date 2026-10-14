// Where emails meant for the person running the service go: plan requests and feedback. Each can have
// its own address; they all fall back to the public contact address.
export function adminInbox(kind: "feedback" | "plan"): string {
  const specific = kind === "feedback" ? process.env.FEEDBACK_EMAIL : process.env.PLAN_REQUEST_EMAIL;
  return (specific || process.env.PLAN_REQUEST_EMAIL || process.env.NEXT_PUBLIC_CONTACT_EMAIL || "").trim();
}
