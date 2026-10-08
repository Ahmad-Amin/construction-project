"use client";

import { useLinkStatus } from "next/link";
import { Spinner } from "@/components/spinner";

// Put inside a <Link>: shows a small spinner while that link's page is still loading, after a
// short delay so fast navigations stay clean.
export function LinkPending({ className = "size-3.5" }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span className="pending-hint inline-flex" role="status" aria-label="Loading">
      <Spinner className={className} />
    </span>
  );
}
