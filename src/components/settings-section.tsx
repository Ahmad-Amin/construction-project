import type { LucideIcon } from "lucide-react";

// One group of settings: a short explanation on the left (above on phones), the controls on the right.
export function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="animate-rise grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-8">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-data-accent">
            <Icon className="size-4" aria-hidden />
          </span>
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
      </div>
      <div className="min-w-0 rounded-2xl border border-line bg-surface p-5 sm:p-6">{children}</div>
    </section>
  );
}
