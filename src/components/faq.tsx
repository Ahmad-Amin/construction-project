"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";

type Item = { q: string; a: string };

// A list of questions that open and close, one at a time: opening a question closes the one
// that was open. The first starts open so the section never looks empty.
export function Faq({ items }: { items: Item[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();

  const toggle = (i: number) => setOpen((current) => (current === i ? null : i));

  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map(({ q, a }, i) => {
        const isOpen = open === i;
        const panelId = `${base}-panel-${i}`;
        return (
          <div key={q}>
            <h3>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="group flex w-full items-center justify-between gap-6 py-6 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
              >
                <span className="text-lg font-medium tracking-tight sm:text-xl">{q}</span>
                <span
                  aria-hidden
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    isOpen
                      ? "border-primary bg-primary-soft text-data-accent"
                      : "border-line text-muted group-hover:border-primary group-hover:text-foreground"
                  }`}
                >
                  <Plus className={`size-4 transition-transform duration-200 motion-reduce:transition-none ${isOpen ? "rotate-45" : ""}`} />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              inert={!isOpen}
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <p className="max-w-2xl pb-7 pr-12 text-lg leading-relaxed text-muted">{a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
