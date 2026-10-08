import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Logo } from "@/components/logo";
import { ProjectPreview } from "@/components/project-preview";

const points = [
  "Photos and updates from site, from any phone",
  "Every payment confirmed by both sides",
  "Your data stays yours",
];

// The brand panel beside the sign-in and sign-up forms on large screens.
export function AuthAside() {
  return (
    <aside className="bg-hero relative hidden flex-col justify-between gap-8 overflow-hidden border-r border-line p-10 lg:flex xl:p-14">
      <Logo />

      <div>
        <h2 className="max-w-md text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
          Show your clients exactly where their project stands.
        </h2>
        <p className="mt-4 max-w-md text-muted">
          Progress, payments, receipts and site photos in one place, so nobody has to chase for an update.
        </p>

        {/* A sample of what a homeowner sees. Only when the window is tall enough to hold it. */}
        <div className="mt-8 hidden max-w-sm [@media(min-height:800px)]:block">
          <ProjectPreview compact />
        </div>
      </div>

      <div>
        <ul className="space-y-2.5">
          {points.map((point) => (
            <li key={point} className="flex items-center gap-2.5 text-sm font-medium">
              <span className="flex size-5 items-center justify-center rounded-full bg-success-soft text-success">
                <Check className="size-3" aria-hidden />
              </span>
              {point}
            </li>
          ))}
        </ul>
        <Link href="/trust" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4">
          How we protect your data <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </aside>
  );
}
