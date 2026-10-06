import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { expenseCategoryLabel, type CategoryTotal, type ExpenseCategory } from "@/lib/expenses";
import { formatPKR } from "@/lib/format";

// "Where the money went": one bar per category, largest first. Each row is a link that
// filters the list below to that category (and a second tap clears it).
export function ExpenseBreakdown({
  breakdown,
  total,
  selected,
  hrefFor,
  title = "Where the money went",
}: {
  breakdown: CategoryTotal[];
  total: number;
  selected: ExpenseCategory | null;
  hrefFor: (category: ExpenseCategory | null) => string;
  title?: string;
}) {
  const largest = Math.max(...breakdown.map((b) => b.total), 1);

  return (
    <section className="animate-rise rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <BarChart3 className="size-4 text-data-accent" aria-hidden /> {title}
        </h2>
        <span className="text-sm text-muted">Tap a bar to filter the list</span>
      </div>

      {breakdown.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nothing to show for these filters.</p>
      ) : (
        <ul className="space-y-1">
          {breakdown.map((b, i) => {
            const isSelected = selected === b.category;
            const share = total > 0 ? Math.round((b.total / total) * 100) : 0;
            return (
              <li key={b.category}>
                <Link
                  href={hrefFor(isSelected ? null : b.category)}
                  scroll={false}
                  aria-current={isSelected ? "true" : undefined}
                  className={`block rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2 ${
                    isSelected ? "bg-primary-soft" : ""
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{expenseCategoryLabel[b.category]}</span>
                    <span className="tabular-nums">
                      <span className="font-semibold">{formatPKR(b.total)}</span>
                      <span className="ml-2 inline-block w-9 text-right text-xs text-muted">{share}%</span>
                    </span>
                  </span>
                  <span className="mt-1.5 block h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                    <span
                      className={`animate-grow block h-full rounded-full bg-data-accent ${
                        selected && !isSelected ? "opacity-40" : ""
                      }`}
                      style={{ width: `${(b.total / largest) * 100}%`, animationDelay: `${150 + i * 90}ms` }}
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
