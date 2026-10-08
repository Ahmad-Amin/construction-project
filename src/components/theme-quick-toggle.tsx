"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, readTheme } from "@/lib/theme";

const query = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  window.addEventListener("storage", onChange);
  window.addEventListener("theme-change", onChange);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("theme-change", onChange);
    media.removeEventListener("change", onChange);
  };
}

// What the page actually looks like right now, whether the person chose it or it follows the device.
function currentLook(): "light" | "dark" {
  const chosen = readTheme();
  if (chosen !== "system") return chosen;
  return window.matchMedia(query).matches ? "dark" : "light";
}

// A one-tap light/dark switch for the top bar. "Follow the device" is still in Settings.
export function ThemeQuickToggle() {
  const look = useSyncExternalStore(subscribe, currentLook, () => "dark" as const);
  const next = look === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="flex size-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
    >
      {look === "dark" ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
    </button>
  );
}
