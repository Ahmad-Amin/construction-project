import Link from "next/link";
import { AlertTriangle, Banknote, Camera, CalendarDays, CheckCircle2, Flag, PartyPopper, UserPlus, type LucideIcon } from "lucide-react";
import { timeAgo } from "@/lib/format";
import type { NotificationItem, NotificationKind } from "@/lib/notifications";

const icons: Record<NotificationKind, { icon: LucideIcon; tone: string }> = {
  payment_recorded: { icon: Banknote, tone: "bg-primary-soft text-data-accent" },
  payment_confirmed: { icon: CheckCircle2, tone: "bg-success-soft text-success" },
  payment_disputed: { icon: AlertTriangle, tone: "bg-danger-soft text-danger" },
  update_posted: { icon: Camera, tone: "bg-primary-soft text-data-accent" },
  milestone_completed: { icon: Flag, tone: "bg-success-soft text-success" },
  client_joined: { icon: UserPlus, tone: "bg-primary-soft text-data-accent" },
  project_completed: { icon: PartyPopper, tone: "bg-success-soft text-success" },
  weekly_summary: { icon: CalendarDays, tone: "bg-primary-soft text-data-accent" },
};

// One notification, used in the bell's dropdown and on the Notifications page.
export function NotificationRow({ item, onOpen }: { item: NotificationItem; onOpen?: () => void }) {
  const { icon: Icon, tone } = icons[item.kind];

  return (
    <Link
      href={item.link}
      onClick={onOpen}
      className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2"
    >
      <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm ${item.read ? "font-medium" : "font-semibold"}`}>{item.title}</span>
        {item.body && <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{item.body}</span>}
        <span className="mt-1 block text-xs text-muted">{timeAgo(item.createdAt)}</span>
      </span>
      {!item.read && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
    </Link>
  );
}
