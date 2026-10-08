import { HardHat, Home, Users } from "lucide-react";

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
export function RoleTag({ role, className = "" }: { role: Role; className?: string }) {
  const { icon: Icon, tone } = STYLE[role];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tone} ${className}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {ROLE_LABEL[role]}
    </span>
  );
}
