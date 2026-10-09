import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export type AuthVariant = "signin" | "signup" | "invite" | "reset";

const copy: Record<AuthVariant, { headline: string; body: string; points: string[] }> = {
  signin: {
    headline: "Welcome back. Pick up where the work left off.",
    body: "Your projects, site photos and payments are all here, just as you left them.",
    points: ["Photos and updates from site, from any phone", "Every payment confirmed by both sides", "Your data stays yours"],
  },
  signup: {
    headline: "Set it up once. Every project gets its own page.",
    body: "Add your company, add a project, and send your client one private link. That's all it takes.",
    points: ["Set up in a few minutes", "Nothing for your client to install", "You choose what your client sees"],
  },
  invite: {
    headline: "Your contractor has set up a page for your project.",
    body: "See the progress, the photos and every payment in one place, whenever you like. No calling around.",
    points: ["You only see your own project", "Every payment is confirmed by both of you", "Nothing to install"],
  },
  reset: {
    headline: "Locked out? It happens to everyone.",
    body: "Tell us your email and we'll send you a link to choose a new password.",
    points: [],
  },
};

// The warm panel beside the form on large screens: why you're here, in a few plain words.
export function AuthAside({ variant }: { variant: AuthVariant }) {
  const { headline, body, points } = copy[variant];

  return (
    <aside className="bg-hero relative hidden overflow-hidden rounded-[2rem] border border-line p-10 lg:flex lg:flex-col lg:self-center xl:p-14">
      <div className="max-w-md">
        <h2 className="text-balance text-3xl font-semibold leading-[1.12] tracking-tight xl:text-4xl">{headline}</h2>
        <p className="mt-4 text-lg leading-relaxed text-muted">{body}</p>
      </div>

      <div className="mt-10">
        {points.length > 0 && (
          <ul className="space-y-3">
            {points.map((point) => (
              <li key={point} className="flex items-center gap-2.5 font-medium">
                <CheckCircle2 className="size-5 shrink-0 text-data-accent" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        )}
        <Link href="/trust" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4">
          How we look after your data <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </aside>
  );
}
