import Link from "next/link";
import { PlanCards } from "@/components/plan-cards";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";
import { planCtas } from "@/lib/billing";
import { CONTACT_EMAIL, PRODUCT_NAME } from "@/lib/site";
import { button } from "@/lib/ui";

export const metadata = {
  title: "Pricing",
  description: `Start free with one active project. Move to Pro or Business when you run several jobs at once. Your clients never pay.`,
  alternates: { canonical: "/pricing" },
};

const faqs = [
  {
    q: "Do my clients pay anything?",
    a: `No. Only the contractor has a plan. Clients are invited free, see only their own project, and never need a card.`,
  },
  {
    q: "What counts as an active project?",
    a: `A project whose status is Active. Completed, On hold and Archived projects don't count, so you can finish a job, or pause one, and start the next without paying more.`,
  },
  {
    q: "What happens when I reach my limit?",
    a: `You can't start another active project until you finish or archive one, or move to a bigger plan. Nothing is deleted or hidden, and your clients keep full access to everything.`,
  },
  {
    q: "What if I stop paying?",
    a: `Your account goes back to Free. Every project, photo, payment and document stays exactly where it is, and your projects keep running. You just can't start new ones beyond the Free limit, and automatic WhatsApp updates and PDF statements pause until you renew.`,
  },
  {
    q: "What is the difference between WhatsApp updates and the share buttons?",
    a: `The one-tap share buttons open WhatsApp on your own phone with the message ready, and they are free on every plan. Automatic WhatsApp updates are sent by ${PRODUCT_NAME} to your client whenever something happens, and they are part of the paid plans.`,
  },
  {
    q: "How do I pay?",
    a: `For now we set it up with you by email: bank transfer or a local wallet such as Easypaisa or JazzCash for customers in Pakistan, and bank transfer elsewhere. Card payments are coming.`,
  },
  {
    q: "Which currency are the prices in?",
    a: `US dollars. The figures in Pakistani rupees are rough, so you know what to expect. Your projects can be in any currency: that is a separate setting.`,
  },
];

export default function PricingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <PublicHeader wide />

      <main className="mx-auto w-full max-w-[96rem] flex-1 px-5 py-12 sm:px-6 sm:py-16 lg:px-12 2xl:px-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-data-accent">Pricing</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Start free. Pay when you run more jobs.</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            One project is free forever. Pro and Business are for contractors with several jobs at the same time. Your clients never pay.
          </p>
        </div>

        <div className="mt-12">
          <PlanCards ctas={planCtas(true)} />
          <p className="mt-6 text-center text-sm text-muted">
            Create your free account first; you can move to Pro or Business from Settings whenever you like.
          </p>
        </div>

        <section className="mx-auto mt-20 max-w-3xl" aria-labelledby="pricing-faq">
          <h2 id="pricing-faq" className="text-2xl font-bold tracking-tight">Questions about plans</h2>
          <dl className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
            {faqs.map((f) => (
              <div key={f.q} className="px-5 py-4 sm:px-6">
                <dt className="font-semibold">{f.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-10 rounded-3xl border border-line bg-hero p-6 text-center sm:p-8">
            <h2 className="text-xl font-bold tracking-tight">Not sure which plan fits?</h2>
            <p className="mt-2 text-muted">
              {CONTACT_EMAIL ? (
                <>
                  Write to{" "}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-foreground underline underline-offset-4">
                    {CONTACT_EMAIL}
                  </a>{" "}
                  and we will help you choose.
                </>
              ) : (
                "Start free and see how it feels with a real project."
              )}
            </p>
            <Link href="/signup" className={`${button("primary")} mt-5`}>
              Create a free account
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter wide />
    </div>
  );
}
