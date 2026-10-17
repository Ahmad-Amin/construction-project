"use client";

import { useEffect, useState } from "react";
import { Bell, Building2, CalendarDays, Database, Palette, ShieldCheck, Sparkles, UserRound, type LucideIcon, Receipt } from "lucide-react";

// The icon for each section, looked up by its id here (icons are components, which a server page
// can't hand to a client one).
const ICONS: Record<string, LucideIcon> = {
  profile: UserRound,
  notifications: Bell,
  appearance: Palette,
  security: ShieldCheck,
  company: Building2,
  "client-updates": CalendarDays,
  plan: Sparkles,
  invoices: Receipt,
  data: Database,
};

export type SettingsNavItem = { id: string; label: string };
export type SettingsNavGroup = { label: string; items: SettingsNavItem[] };

// The list of sections beside the settings (above them on a phone, as a row of buttons). The one you
// are reading is highlighted as you scroll, and tapping one scrolls straight to it.
export function SettingsNav({ groups }: { groups: SettingsNavGroup[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const ids = groups.flatMap((g) => g.items.map((i) => i.id));
    const sections = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // The first visible section, in page order, is the current one.
        setActive(ids.find((id) => visible.has(id)) ?? null);
      },
      { rootMargin: "-15% 0px -65% 0px", threshold: 0 },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [groups]);

  function go(id: string) {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  }

  const all = groups.flatMap((g) => g.items);

  return (
    <>
      {/* Phones and small tablets: a row of buttons that scrolls sideways. */}
      <nav aria-label="Settings sections" className="-mx-4 mb-6 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:hidden">
        <ul className="flex w-max gap-2 pb-1">
          {all.map(({ id, label }) => {
            const Icon = ICONS[id] ?? UserRound;
            return (
            <li key={id}>
              <button
                type="button"
                onClick={() => go(id)}
                aria-current={active === id ? "true" : undefined}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                  active === id ? "border-primary bg-primary-soft text-primary-hover" : "border-line bg-surface text-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            </li>
            );
          })}
        </ul>
      </nav>

      {/* Larger screens: a column that stays in view while the settings scroll. */}
      <nav aria-label="Settings sections" className="sticky top-24 hidden self-start lg:block">
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted">{group.label}</p>
              <ul className="mt-2 space-y-0.5">
                {group.items.map(({ id, label }) => {
                  const Icon = ICONS[id] ?? UserRound;
                  return (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        go(id);
                      }}
                      aria-current={active === id ? "true" : undefined}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active === id ? "bg-primary-soft text-primary-hover" : "text-muted hover:bg-surface-2 hover:text-foreground"
                      }`}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden /> {label}
                    </a>
                  </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}
