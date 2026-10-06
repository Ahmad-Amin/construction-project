import Link from "next/link";
import { HardHat } from "lucide-react";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 whitespace-nowrap">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <HardHat className="size-5" aria-hidden />
      </span>
      <span className="text-lg font-bold tracking-tight">Client Portal</span>
    </Link>
  );
}
