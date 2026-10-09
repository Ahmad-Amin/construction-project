// Shared class strings so buttons and inputs look the same everywhere.
const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60";

// On a phone the controls stay roomy enough to tap; on a larger screen they tighten up.
const sizes = {
  lg: "px-6 py-3.5 text-base",
  md: "px-4 py-3 text-base sm:px-5 sm:py-2.5 sm:text-sm",
  sm: "px-3.5 py-2 text-sm sm:py-1.5",
};

const variants = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary: "border border-line bg-surface text-foreground hover:bg-surface-2",
  ghost: "text-foreground hover:bg-surface-2",
};

export function button(
  variant: keyof typeof variants = "primary",
  size: keyof typeof sizes = "md",
) {
  return `${base} ${sizes[size]} ${variants[variant]}`;
}

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-foreground sm:py-2 sm:text-sm placeholder:text-muted/70 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30";
