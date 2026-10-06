"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/projects/${projectId}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/timeline`, label: "Timeline" },
    { href: `${base}/progress`, label: "Progress" },
    { href: `${base}/updates`, label: "Updates" },
    { href: `${base}/expenses`, label: "Expenses" },
    { href: `${base}/payments`, label: "Payments" },
  ];

  return (
    <nav aria-label="Project sections" className="-mx-4 mt-5 overflow-x-auto border-b border-line px-4 lg:hidden">
      <ul className="flex gap-1">
        {tabs.map((t) => {
          // Sub-pages (like /updates/new) keep their section's tab lit.
          const active = t.href === base ? pathname === base : pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px inline-block whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
