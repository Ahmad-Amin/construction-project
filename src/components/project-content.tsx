"use client";

import { usePathname } from "next/navigation";

// Every project section (Overview, Timeline, Progress, Updates, Expenses, Payments, Documents, ...)
// uses the full width; the forms narrow themselves. Only the Edit project page reads best in a
// narrower column.
export function ProjectContent({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const narrow = pathname === `/dashboard/projects/${projectId}/edit`;
  return <div className={`mt-6 ${narrow ? "max-w-3xl" : ""}`}>{children}</div>;
}
