import type { LucideIcon } from "lucide-react";

// One group of settings, as a card: a heading (icon, title, one line about it) and the controls
// below. The controls use the whole width of the card; forms inside lay their fields out side by side
// on a wide screen so nothing stretches into one long text box.
export function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  children,
}: {
  // Lets a link jump straight to this section, like /dashboard/settings#plan.
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="animate-rise scroll-mt-24 overflow-hidden rounded-3xl border border-line bg-surface">
      <header className="flex items-start gap-4 border-b border-line px-5 py-5 sm:px-8">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-data-accent">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <p className="mt-0.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
        </div>
      </header>
      <div className="px-5 py-6 sm:px-8 sm:py-7">{children}</div>
    </section>
  );
}

// A list of switches: each one a full-width row, with a line between them, so a label on the left and
// its switch on the right read as one thing however wide the screen is.
export function SettingsRows({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line [&>*]:px-5 [&>*]:py-5">{children}</div>;
}
