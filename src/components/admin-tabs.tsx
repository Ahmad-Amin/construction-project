"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The two pages of the plans admin: the companies, and the history of every change.
export function AdminTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/dashboard/admin", label: "Companies" },
    { href: "/dashboard/admin/history", label: "History" },
  ];
  return (
    <nav aria-label="Plans admin" className="mb-8 flex gap-1 border-b border-line">
      {tabs.map((t) => {
        const active = t.href === "/dashboard/admin" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              active ? "border-primary text-foreground" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
