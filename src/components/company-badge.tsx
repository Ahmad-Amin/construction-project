// The contractor's logo, or their initial when they haven't uploaded one.
export function CompanyBadge({
  name,
  logoUrl,
  size = "md",
}: {
  name: string;
  logoUrl: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const box = { sm: "size-6 text-xs", md: "size-9 text-sm", lg: "size-20 text-2xl" }[size];

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- public logo, size is capped at upload
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className={`${box} shrink-0 rounded-lg bg-white object-contain`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${box} flex shrink-0 items-center justify-center rounded-lg bg-surface-2 font-bold text-muted`}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
