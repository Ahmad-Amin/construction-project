"use client";

import { usePathname } from "next/navigation";

// The Overview uses the full width for its card grid; every other project page
// (lists and forms) reads best in a narrower column.
export function ProjectContent({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const overview = usePathname() === `/dashboard/projects/${projectId}`;
  return <div className={`mt-6 ${overview ? "" : "max-w-3xl"}`}>{children}</div>;
}
