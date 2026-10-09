"use client";

import { useEffect, useState } from "react";

type Item = { href: string; label: string };

// The page's section links in the header. The link for the section you are reading is
// highlighted as you scroll, and the moment you click one.
export function SectionNav({ items }: { items: Item[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const ids = items.map((i) => i.href.slice(1));
    const sections = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (sections.length === 0) return;

    // The section that crosses a thin band a little below the header counts as "current".
    // Above the first section (the top of the page) nothing is highlighted.
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const current = ids.filter((id) => visible.has(id)).at(-1) ?? null;
        setActive(current);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="Page sections" className="hidden items-center gap-1 lg:flex">
      {items.map((item) => {
        const on = active === item.href.slice(1);
        return (
          <a
            key={item.href}
            href={item.href}
            onClick={() => setActive(item.href.slice(1))}
            aria-current={on ? "location" : undefined}
            className={`relative rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              on ? "text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {item.label}
            <span
              aria-hidden
              className={`absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary transition-opacity duration-200 ${
                on ? "opacity-100" : "opacity-0"
              }`}
            />
          </a>
        );
      })}
    </nav>
  );
}
