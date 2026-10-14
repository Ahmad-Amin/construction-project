// The plans. This file is the one place that says what Free, Pro and Business include and cost; the
// pricing page, the sidebar, the settings page and every check read from it. (The database enforces
// the limits itself, in the plans migration: keep the numbers there in step with these.)

export const PLAN_IDS = ["free", "pro", "business"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type PlanInfo = {
  id: PlanId;
  name: string;
  blurb: string;
  // US dollars a month when billed monthly, and the price of a year (two months free). Null when free.
  monthlyUsd: number | null;
  yearlyUsd: number | null;
  // A rough local figure to help people in Pakistan; the card price is the one in dollars.
  approxMonthlyPkr: number | null;
  // How many projects can be Active at once; null means no limit.
  activeProjects: number | null;
  // Automatic WhatsApp messages to the client, and the PDF project statement.
  whatsapp: boolean;
  statements: boolean;
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
    whatsapp: false,
    statements: false,
  },
  pro: {
    id: "pro",
    name: "Pro",
    blurb: "For a contractor with several jobs running at once.",
    monthlyUsd: 15,
    yearlyUsd: 150,
    approxMonthlyPkr: 4000,
    activeProjects: 10,
    whatsapp: true,
    statements: true,
  },
  business: {
    id: "business",
    name: "Business",
    blurb: "No limit on projects, and priority support.",
    monthlyUsd: 39,
    yearlyUsd: 390,
    approxMonthlyPkr: 11000,
    activeProjects: null,
    whatsapp: true,
    statements: true,
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

export const canSendWhatsApp = (plan: PlanId) => PLANS[plan].whatsapp;
export const canMakeStatements = (plan: PlanId) => PLANS[plan].statements;

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
