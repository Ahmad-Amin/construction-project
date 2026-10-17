"use client";

import { useEffect, useRef, useState } from "react";
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
  // A section picked from this list stays highlighted until the person scrolls on their own: near the bottom of the
  // page a short section can't reach the top, and the scroll position alone would point at its neighbour.
  const picked = useRef<string | null>(null);

  useEffect(() => {
    const ids = groups.flatMap((g) => g.items.map((i) => i.id));
    let frame = 0;
    const update = () => {
      frame = 0;
      if (picked.current) return;
      const sections = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
      if (sections.length === 0) return;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      // At the very bottom, the last section is the one being read (it may be too short to reach the top). Otherwise
      // it's the last section whose top has passed the upper third of the screen.
      let current = sections[0].id;
      if (atBottom) current = sections[sections.length - 1].id;
      else {
        const line = window.innerHeight * 0.3;
        for (const section of sections) if (section.getBoundingClientRect().top <= line) current = section.id;
      }
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // Scrolling by hand (wheel, touch, keys) hands the highlight back to the scroll position.
    const release = () => {
      if (picked.current) {
        picked.current = null;
        schedule();
      }
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const manual = ["wheel", "touchstart", "keydown"] as const;
    manual.forEach((ev) => window.addEventListener(ev, release, { passive: true }));
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      manual.forEach((ev) => window.removeEventListener(ev, release));
    };
  }, [groups]);

  function go(id: string) {
    picked.current = id;
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
