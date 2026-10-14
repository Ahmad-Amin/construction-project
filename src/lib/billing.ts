import type { PlanCta, PlanCtas } from "@/components/plan-cards";

// The button for every plan, for monthly and yearly billing, as the plan cards need it. On the public
// pricing page they all lead to sign-up. Inside the app, Pro and Business ask for the plan with one tap
// (an email to us, and a confirmation to the owner) until online checkout is switched on.
export function planCtas(publicPage = false): PlanCtas {
  const build = (): Record<"free" | "pro" | "business", PlanCta> => ({
    free: publicPage ? { kind: "link", href: "/signup", label: "Start free" } : null,
    pro: publicPage ? { kind: "link", href: "/signup", label: "Get Pro" } : { kind: "request", label: "Request Pro" },
    business: publicPage ? { kind: "link", href: "/signup", label: "Get Business" } : { kind: "request", label: "Request Business" },
  });
  return { monthly: build(), yearly: build() };
}
