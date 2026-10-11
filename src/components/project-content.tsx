"use client";

import { usePathname } from "next/navigation";

// The Overview, Payments, Expenses, Updates, Progress and Timeline use the full width (the payment forms narrow themselves); every other project page
// (lists and forms) reads best in a narrower column.
export function ProjectContent({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const base = `/dashboard/projects/${projectId}`;
  const wide =
    pathname === base || ["payments", "expenses", "updates", "progress", "timeline"].some((area) => pathname === `${base}/${area}` || pathname.startsWith(`${base}/${area}/`));
  return <div className={`mt-6 ${wide ? "" : "max-w-3xl"}`}>{children}</div>;
}
