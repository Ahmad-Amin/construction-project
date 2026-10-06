import Link from "next/link";
import { Compass } from "lucide-react";
import { Logo } from "@/components/logo";
import { button } from "@/lib/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <Logo />
      <span className="mt-10 flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Compass className="size-7" aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-bold tracking-tight">We can&apos;t find that page</h1>
      <p className="mt-2 max-w-sm text-muted">
        The link may be wrong, or this project may not be shared with your account.
      </p>
      <Link href="/dashboard" className={`${button("primary")} mt-6`}>
        Go to my projects
      </Link>
    </div>
  );
}
