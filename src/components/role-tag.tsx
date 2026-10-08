import { Briefcase, HardHat, Home, Users } from "lucide-react";

export type Role = "contractor" | "staff" | "homeowner";

export const ROLE_LABEL: Record<Role, string> = {
  contractor: "Contractor",
  staff: "Site team",
  homeowner: "Homeowner",
};

export const roleOf = (isOwner: boolean, hasCompany: boolean): Role =>
  isOwner ? "contractor" : hasCompany ? "staff" : "homeowner";

const STYLE: Record<Role, { icon: typeof HardHat; tone: string }> = {
  contractor: { icon: HardHat, tone: "bg-primary-soft text-primary" },
  staff: { icon: Users, tone: "bg-surface-2 text-foreground" },
  homeowner: { icon: Home, tone: "bg-success-soft text-success" },
};

// Always-visible label for which kind of account is signed in.
export function RoleTag({
  role,
  className = "",
  iconOnly = false,
}: {
  role: Role;
  className?: string;
  iconOnly?: boolean;
}) {
  const { icon, tone } = STYLE[role];
  // The folded sidebar already shows the hard hat as the logo, so the contractor gets another icon there.
  const Icon = iconOnly && role === "contractor" ? Briefcase : icon;
  if (iconOnly) {
    return (
      <span
        title={ROLE_LABEL[role]}
        role="img"
        aria-label={ROLE_LABEL[role]}
        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${tone} ${className}`}
      >
        <Icon className="size-4" aria-hidden />
      </span>
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tone} ${className}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {ROLE_LABEL[role]}
    </span>
  );
}
