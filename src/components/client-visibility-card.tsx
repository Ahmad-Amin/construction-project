import Link from "next/link";
import { Check, Eye, EyeOff, Lock } from "lucide-react";
import { formatPKR } from "@/lib/format";

type Props = {
  projectId: string;
  updates: number;
  payments: number;
  expensesShared: number;
  expensesTotal: number;
  sharedAmount: number;
  hiddenAmount: number;
  budgetShown: boolean | null; // null = no budget set
};

function Row({ icon: Icon, tone, children }: { icon: typeof Check; tone: "ok" | "off"; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
          tone === "ok" ? "bg-success-soft text-success" : "bg-surface-2 text-muted"
        }`}
      >
        <Icon className="size-3" aria-hidden />
      </span>
      <span>{children}</span>
    </li>
  );
}

// For the owner: exactly what the homeowner can and can't see on this project right now,
// worked out from the live sharing settings.
export function ClientVisibilityCard(p: Props) {
  const hidden = p.expensesTotal - p.expensesShared;

  return (
    <section className="animate-rise rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Eye className="size-4 text-data-accent" aria-hidden /> What your client sees
        </h2>
        <Link href={`/dashboard/projects/${p.projectId}/expenses`} className="text-sm font-medium text-muted hover:text-foreground">
          Manage sharing
        </Link>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Shared with your client</p>
          <ul className="space-y-2">
            <Row icon={Check} tone="ok">Progress and every milestone</Row>
            <Row icon={Check} tone="ok">
              {p.updates} site {p.updates === 1 ? "update" : "updates"} and their photos
            </Row>
            <Row icon={Check} tone="ok">
              All {p.payments} {p.payments === 1 ? "payment" : "payments"}, both sides confirm each one
            </Row>
            <Row icon={Check} tone="ok">
              {p.expensesShared} of {p.expensesTotal} {p.expensesTotal === 1 ? "expense" : "expenses"} (
              {formatPKR(p.sharedAmount)}), with receipts
            </Row>
            {p.budgetShown && <Row icon={Check} tone="ok">The project budget</Row>}
          </ul>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Only you can see</p>
          <ul className="space-y-2">
            {hidden > 0 ? (
              <Row icon={EyeOff} tone="off">
                {hidden} hidden {hidden === 1 ? "expense" : "expenses"} ({formatPKR(p.hiddenAmount)}) and{" "}
                {hidden === 1 ? "its" : "their"} receipts. They never appear in your client&apos;s list, totals or
                timeline.
              </Row>
            ) : (
              <Row icon={Lock} tone="off">No hidden expenses. New ones start hidden until you share them.</Row>
            )}
            {p.budgetShown === false && <Row icon={EyeOff} tone="off">The project budget</Row>}
            <Row icon={Lock} tone="off">Other clients&apos; projects. Nobody else can see this one.</Row>
          </ul>
        </div>
      </div>
    </section>
  );
}
