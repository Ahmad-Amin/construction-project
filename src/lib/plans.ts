// The plans. This file is the one place that says what Free, Pro and Business include and cost; the
// pricing page, the sidebar, the settings page and every check read from it. (The database enforces
// the limits itself, in the plans migration: keep the numbers there in step with these.)

export const PLAN_IDS = ["free", "pro", "business"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type PlanInfo = {
  id: PlanId;
  name: string;
  blurb: string;
  // US dollars a month when billed monthly, and the price of a year: about one month free, set so it works out to
  // whole dollars a month ($384 is $32 a month). Null when free.
  monthlyUsd: number | null;
  yearlyUsd: number | null;
  // A rough local figure to help people in Pakistan; the card price is the one in dollars.
  approxMonthlyPkr: number | null;
  // How many projects can be Active at once; null means no limit.
  activeProjects: number | null;
  // How many staff accounts (site supervisors and so on) the owner can have, pending invitations included.
  staff: number;
  // Automatic WhatsApp messages to the client, and the PDF project statement.
  whatsapp: boolean;
  statements: boolean;
  // Creating and sending invoices.
  invoices: boolean;
  // Site videos on updates: the longest one, and how many minutes of new video a month (0 when not included).
  // The database has the same numbers (plan_video_max_seconds, plan_video_monthly_seconds).
  videoMaxSeconds: number;
  videoMonthlyMinutes: number;
};

export const PLANS: Record<PlanId, PlanInfo> = {
  free: {
    id: "free",
    name: "Free",
    blurb: "Run one job properly, with your client following along.",
    monthlyUsd: null,
    yearlyUsd: null,
    approxMonthlyPkr: null,
    activeProjects: 1,
    staff: 0,
    whatsapp: false,
    statements: false,
    invoices: false,
    videoMaxSeconds: 0,
    videoMonthlyMinutes: 0,
  },
  pro: {
    id: "pro",
    name: "Pro",
    blurb: "For a contractor with several jobs running at once.",
    monthlyUsd: 35,
    yearlyUsd: 384,
    approxMonthlyPkr: 10000,
    activeProjects: 10,
    staff: 3,
    whatsapp: true,
    statements: true,
    invoices: true,
    videoMaxSeconds: 180,
    videoMonthlyMinutes: 60,
  },
  business: {
    id: "business",
    name: "Business",
    blurb: "No limit on projects, and priority support.",
    monthlyUsd: 70,
    yearlyUsd: 768,
    approxMonthlyPkr: 20000,
    activeProjects: null,
    staff: 10,
    whatsapp: true,
    statements: true,
    invoices: true,
    videoMaxSeconds: 300,
    videoMonthlyMinutes: 200,
  },
};

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

// The plan that counts right now. A paid plan whose end date has passed counts as Free; a paid
// plan with no end date never runs out (one given by hand). Mirrors effective_plan() in the database.
export function effectivePlan(plan: string | null | undefined, until: string | null | undefined, now = Date.now()): PlanId {
  if ((plan === "pro" || plan === "business") && (!until || new Date(until).getTime() > now)) return plan;
  return "free";
}

// True when a paid plan was set but has ended: worth telling the owner.
export function planLapsed(plan: string | null | undefined, until: string | null | undefined, now = Date.now()): boolean {
  return (plan === "pro" || plan === "business") && !!until && new Date(until).getTime() <= now;
}

// "3 staff accounts", "No staff accounts".
export function staffLimitText(plan: PlanId): string {
  const n = PLANS[plan].staff;
  return n === 0 ? "No staff accounts" : `${n} staff ${n === 1 ? "account" : "accounts"}`;
}

export const canSendWhatsApp = (plan: PlanId) => PLANS[plan].whatsapp;
export const canMakeStatements = (plan: PlanId) => PLANS[plan].statements;
export const canMakeInvoices = (plan: PlanId) => PLANS[plan].invoices;

export type Usage = { used: number; limit: number | null; atLimit: boolean };

export function usage(plan: PlanId, activeProjects: number): Usage {
  const limit = PLANS[plan].activeProjects;
  return { used: activeProjects, limit, atLimit: limit !== null && activeProjects >= limit };
}

export function usageText(plan: PlanId, activeProjects: number): string {
  const { limit } = usage(plan, activeProjects);
  if (limit === null) return `${activeProjects} active ${activeProjects === 1 ? "project" : "projects"}`;
  return `${activeProjects} of ${limit} active ${limit === 1 ? "project" : "projects"}`;
}

// The one sentence shown wherever a limit stops someone.
export function limitMessage(plan: PlanId): string {
  const limit = PLANS[plan].activeProjects;
  if (limit === null) return "";
  return `Your ${PLANS[plan].name} plan includes ${limit} active ${limit === 1 ? "project" : "projects"}. Finish or archive a project, or upgrade to start another.`;
}
