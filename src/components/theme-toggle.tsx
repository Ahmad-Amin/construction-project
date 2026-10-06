"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { applyTheme, readTheme, type Theme } from "@/lib/theme";

const options: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("theme-change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("theme-change", onChange);
  };
}

// The choice lives on this device only. "System" follows the phone or laptop setting.
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);

  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
      {options.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => applyTheme(value)}
            className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm font-medium transition-colors ${
              active
                ? "border-primary bg-primary-soft text-foreground"
                : "border-line bg-surface hover:bg-surface-2 text-muted"
            }`}
          >
            <Icon className={`size-5 ${active ? "text-data-accent" : ""}`} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
