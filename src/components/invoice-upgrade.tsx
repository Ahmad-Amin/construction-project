import Link from "next/link";
import { ArrowRight, Receipt } from "lucide-react";
import { button } from "@/lib/ui";

// Shown instead of the invoice form on the Free plan.
export function InvoiceUpgrade() {
  return (
    <section className="max-w-2xl rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Receipt className="size-5" aria-hidden />
      </span>
      <h2 className="mt-4 text-xl font-bold tracking-tight">Invoices are part of Pro and Business</h2>
      <p className="mt-2 text-muted">
        Create invoices with your logo and payment details, send them to your client in one tap, and keep every one on record.
      </p>
      <Link href="/dashboard/settings#plan" className={`${button("primary")} mt-6`}>
        See plans <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}
