export type Theme = "system" | "light" | "dark";

// The saved choice for this device. Anything unrecognised means "follow the system".
export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem("theme");
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

// Saves the choice and applies it to the page straight away. Kept outside any
// component because it changes the document, not React state.
export function applyTheme(next: Theme) {
  const root = document.documentElement;
  try {
    if (next === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", next);
  } catch {
    // Storage can be blocked; the page still changes for this visit.
  }
  if (next === "system") delete root.dataset.theme;
  else root.dataset.theme = next;
  window.dispatchEvent(new Event("theme-change"));
}
