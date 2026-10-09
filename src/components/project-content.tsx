"use client";

import { usePathname } from "next/navigation";

// The Overview and the Payments area use the full width (the payment forms narrow themselves); every other project page
// (lists and forms) reads best in a narrower column.
export function ProjectContent({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const base = `/dashboard/projects/${projectId}`;
  const wide = pathname === base || pathname === `${base}/payments` || pathname.startsWith(`${base}/payments/`);
  return <div className={`mt-6 ${wide ? "" : "max-w-3xl"}`}>{children}</div>;
}
