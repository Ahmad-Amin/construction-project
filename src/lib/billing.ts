import { PLANS, type PlanId } from "@/lib/plans";
import { CONTACT_EMAIL, PRODUCT_NAME } from "@/lib/site";

export type Cta = { href: string; label: string; external?: boolean };

// Where the "Upgrade" buttons go. Until online checkout is switched on, they open an email to us
// with the plan and company already written in; the plan is then changed by hand once it is paid.
export function upgradeCta(plan: PlanId, yearly: boolean, companyName: string): Cta | null {
  if (plan === "free") return null;
  const info = PLANS[plan];
  const label = `Choose ${info.name}`;
  if (!CONTACT_EMAIL) return { href: "/signup", label };
  const subject = encodeURIComponent(`${PRODUCT_NAME} ${info.name} plan (${yearly ? "yearly" : "monthly"})`);
  const body = encodeURIComponent(
    `Hello,\n\nI'd like to move ${companyName ? `"${companyName}"` : "my company"} to the ${info.name} plan, billed ${yearly ? "yearly" : "monthly"}.\n\nThank you.`,
  );
  return { href: `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`, label, external: false };
}

// The button for every plan, for monthly and yearly billing: what the plan cards need.
export function planCtas(companyName: string, publicPage = false) {
  const build = (yearly: boolean) => ({
    free: publicPage ? ({ href: "/signup", label: "Start free" } as Cta) : null,
    pro: publicPage ? ({ href: "/signup", label: "Get Pro" } as Cta) : upgradeCta("pro", yearly, companyName),
    business: publicPage ? ({ href: "/signup", label: "Get Business" } as Cta) : upgradeCta("business", yearly, companyName),
  });
  return { monthly: build(false), yearly: build(true) };
}
