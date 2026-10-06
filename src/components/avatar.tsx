// A person's initials on a warm gradient. Used where there's no photo.
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?";
  const box = { sm: "size-8 text-xs", md: "size-11 text-sm", lg: "size-20 text-2xl" }[size];

  return (
    <span
      aria-hidden
      className={`${box} flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-amber-400 to-amber-600 font-bold text-stone-900`}
    >
      {initials}
    </span>
  );
}
