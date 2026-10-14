import Link from "next/link";
import { DOCUMENT_CATEGORIES, documentCategoryLabel, type DocumentCategory } from "@/lib/documents";

export type DocumentFilter = "all" | "client" | DocumentCategory;

// The documents list filter: one pill per type that has documents, plus the homeowner's own. Plain
// links, so each view has its own address and nothing needs a script.
export function DocumentFilterBar({
  base,
  active,
  counts,
  clientLabel,
}: {
  base: string;
  active: DocumentFilter;
  // How many documents each pill would show.
  counts: Record<DocumentFilter, number>;
  clientLabel: string;
}) {
  const pills: { value: DocumentFilter; label: string }[] = [
    { value: "all", label: "All" },
    ...DOCUMENT_CATEGORIES.map((c) => ({ value: c as DocumentFilter, label: documentCategoryLabel[c] })),
    { value: "client", label: clientLabel },
  ];

  const style = (isActive: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
      isActive
        ? "border-primary bg-primary-soft text-foreground"
        : "border-line bg-surface text-muted hover:bg-surface-2 hover:text-foreground"
    }`;

  return (
    <div role="group" aria-label="Filter by type" className="mb-5 flex flex-wrap gap-1.5">
      {pills.map(({ value, label }) => {
        const isActive = active === value;
        const count = counts[value];
        const content = (
          <>
            {label}
            <span className="text-xs tabular-nums opacity-70">{count}</span>
          </>
        );
        // Nothing to show under this type: greyed out, like an empty status on the project list.
        if (count === 0 && !isActive) {
          return (
            <span key={value} aria-disabled="true" className={`${style(false)} cursor-not-allowed opacity-45`}>
              {content}
            </span>
          );
        }
        return (
          <Link
            key={value}
            href={value === "all" ? base : `${base}?type=${value}`}
            scroll={false}
            aria-current={isActive ? "true" : undefined}
            className={style(isActive)}
          >
            {content}
          </Link>
        );
      })}
    </div>
  );
}
